import _ from 'underscore';
import { CMC7Parser } from './cmc7-parser';
import { queue } from 'async';
import { titleCase } from 'change-case';
import { CPF } from 'cpf_cnpj';
import { CNPJ } from 'cpf_cnpj';

const PAGINATE_FILTER = 7;

/* global module, numeral */
module.exports = function(controller) {

    function modalChecksIsEmpty() {
        let modal = controller.call("modal");

        modal.title("Você não selecionou nenhum cheque");
        modal.subtitle("Seleção de Cheques para Antecipação");
        modal.addParagraph("É necessário selecionar pelo menos um cheque para solicitar antecipação");

        let form = modal.createForm();

        form.addSubmit("close", "Ok");
        form.element().submit((e) => {
            e.preventDefault();
            modal.close();
        });
    }

    controller.registerCall("icheques::antecipate::checksIsEmpty", modalChecksIsEmpty);

    /* List Banks */
    controller.registerCall("icheques::antecipate", function(checks) {
        var expired = [];
        checks = _.filter(checks, (check) => {
            var booleanExpiration = moment().diff(check.expire, 'days') < 0;
            if (!booleanExpiration) {
                toastr.warning("Alguns cheques da sua carteira estão vencidos.", "Cheques vencidos não podem ser antecipados, caso queira extender o vencimento em 30 dias nós abrimos os mesmos abaixo.");
                expired.push(check);
            }
            return booleanExpiration;
        });

        if (expired.length) {
            controller.call("icheques::show", expired);
        }

        if (!checks.length) {
            toastr.error("Não há cheques bons para antecipação, verifique e tente novamente.", "Não há cheques em seja possível a antecipação.");
            return;
        }

        // Adicionando as propriedades vindas do CMC7Parser
        checks = checks.map((check) => Object.assign({}, check, new CMC7Parser(check.cmc)));

        // Ordenando pelo número do cheque
        checks = _.sortBy(checks, "number");


        controller.call("billingInformation::need", () => {
            var noAmmountChecks = _.filter(checks, (obj) => {
                return !obj.ammount;
            });

            if (noAmmountChecks.length) {
                controller.call("confirm", {
                    icon: "fail",
                    title: "Você não preencheu o valor de alguns cheques.",
                    subtitle: `Você precisa configurar o valor de ${noAmmountChecks.length}
                    ${noAmmountChecks.length == 1 ? "cheque" : "cheques"} para poder continuar.`,
                    paragraph: "Tudo que precisar ser editado com o valor será aberto para que você possa repetir esta operação, edite e tente novamente.",
                }, () => {
                    var q = queue(controller.reference("icheques::item::setAmmount"), 1);

                    q.push(noAmmountChecks, (err) => {
                        /* pass */
                    });

                    q.drain = () => {
                        controller.call("icheques::antecipate", _.filter(checks, (obj) => {
                            return obj.ammount > 0;
                        }));
                    };

                });
                return;
            }

            controller.serverCommunication.call("SELECT FROM 'ICHEQUESFIDC'.'LIST'",
                controller.call("loader::ajax", controller.call("error::ajax", {
                    data: {
                        approved: "true"
                    },
                    success: function(ret) {
                        controller.call("icheques::antecipate::filter", ret, checks);
                    }
                })));
        }, (ret) => {
            if (!$("BPQL > body > company > cnpj", ret).text().length) {
                toastr.warning("É necessário um CNPJ de faturamento para poder continuar.",
                    "Você não possui um CNPJ no cadastro.");
                return false;
            }
            return true;
        });
    });

    var updateList = (modal, pageActions, results, pagination, list, checks, limit = PAGINATE_FILTER, skip = 0, text, checksSum, callback) => {
        if (text) {
            text = text.trim();
            checks = _.filter(checks, (check) => {
                let doc = check.cnpj ? CNPJ.format(check.cnpj) : CPF.format(check.cpf);
                return doc.toString().includes(text) || check.number.toString().includes(text);
            });
        } else if (/\D/.test(text)) {
            text = undefined;
        }

        var totalAmmount = _.reduce(_.pluck(checks, 'ammount'), (memo, num) => {
            return memo + num;
        });
        if (checks.length) {
            checksSum.text(numeral(totalAmmount / 100.0).format("$0,0.00"));
        } else {
            checksSum.text("Sem Saldo");
        }

        list.empty();

        var queryResults = checks.length,
            currentPage = Math.floor(skip / limit) + 1,
            pages = Math.ceil(queryResults / limit);

        _.each(checks.slice(skip, skip + limit), (element) => {
            let doc = element.cnpj ? CNPJ.format(element.cnpj) : CPF.format(element.cpf); /* aplica mascara quando nao tiver*/
            list.add("fa-trash", [
                // Número do Cheque
                `Nº do cheque: ${element.number}`,
                // Banco
                `Banco: ${element.bank}`,
                // CPF,
                `Documento: ${doc}`,
                // Valor
                `Valor: ${numeral(parseFloat(element.ammount/100)).format('$ 0,0.00')}`
            ]).click(function(e) {
                checks.splice(checks.indexOf(element), 1);
                updateList(modal, pageActions, results, pagination, list, checks, limit, skip, text, checksSum);
            });
        });

        pageActions.next[currentPage >= pages ? "hide" : "show"]();
        pageActions.back[currentPage <= 1 ? "hide" : "show"]();

        results.text(`Página ${currentPage} de ${pages}`);
        pagination.text(`Resultados ${queryResults}`);

        if (callback) callback();
    };

    controller.registerCall("icheques::antecipate::filter", (data, checks) => {
        let modal = controller.call("modal");
        modal.title("Cheques para Antecipar");
        modal.subtitle("Seleção de Cheques para Antecipação");
        modal.addParagraph("Selecione, da relação abaixo, os cheques que NÃO gostaria de antecipar. Serão eliminados da lista");

        let form = modal.createForm(),
            search = form.addInput("query", "text", "Digite aqui o número do documento ou do cheque para filtrar", {}, "Documento ou nº do cheque"),
            list = form.createList(),
            actions = modal.createActions(),
            skip = 0,
            text = null;

        controller.call("instantSearch", search, (query, autocomplete, callback) => {
            text = query;
            skip = 0;
            updateList(modal, pageActions, results, pagination, list, checks, PAGINATE_FILTER, skip, text, callback);
        });

        form.element().submit((e) => {
            e.preventDefault();

            var totalAmmount = _.reduce(_.pluck(checks, 'ammount'), (memo, num) => {
                return memo + num;
            })

            if (checks.length || totalAmmount <= 0) {
                controller.call("icheques::antecipate::show", data, checks);
            } else {
                controller.call("icheques::antecipate::checksIsEmpty");
            }
            modal.close();
        });
        form.addSubmit("filter", "Enviar Cheques");
        actions.add("Sair").click(function(e) {
            e.preventDefault();
            modal.close();
        });

        let results = actions.observation(),
            pagination = actions.observation(),
            checksSum = actions.observation();

        var pageActions = {
            next: actions.add("Próxima Página").click(() => {
                skip += 5;
                updateList(modal, pageActions, results, pagination, list, checks, PAGINATE_FILTER, skip, text, checksSum);
            }).hide(),

            back: actions.add("Página Anterior").click(() => {
                skip -= 5;
                updateList(modal, pageActions, results, pagination, list, checks, PAGINATE_FILTER, skip, text, checksSum);
            }).hide()
        };

        updateList(modal, pageActions, results, pagination, list, checks, PAGINATE_FILTER, skip, text, checksSum);
    });

    controller.registerCall("icheques::antecipate::show", function(data, checks) {
        var banks = $("BPQL > body > fidc", data);

        if (!banks.length) {
            controller.call("alert", {
                title: "Você não tem o perfil aprovado por nenhum fundo.",
                subtitle: "Atualize seus dados bancários, cadastrais e procure uma factoring iCheques para habilitar essa função."
            });
            return;
        }

        var modal = controller.call("modal");
        modal.title("Factorings iCheques");
        modal.subtitle("Relação de Factorings iCheques");
        modal.addParagraph("Selecione a Factoring iCheque que deseja enviar sua carteira de cheques.");

        var form = modal.createForm(),
            list = form.createList();

        banks.each(function(i, element) {
            list.add("fa-share", [
                $("company > nome", element).text() || $("company > responsavel", element).text() || $("company > username", element).text(),
                `${$("company > endereco > node:eq(4)", element).text()} / ${$("company > endereco > node:eq(6)", element).text()}`,
                $(element).children("bio").text(),
            ]).click(function(e) {
                controller.call("icheques::antecipate::fidc", data, element, checks);
                modal.close();
            });
        });

        list.element().find("li:first div:last").css({
            width: "250px"
        });

        modal.createActions().add("Sair").click(function(e) {
            e.preventDefault();
            modal.close();
        });
    });

    var companyData = (paragraph, element) => {
        var phones = $("<ul />").addClass("phones");
        $("company > telefone > node", element).each((idx, node) => {
            var get = (idx) => {
                return $(`node:eq(${idx.toString()})`, node).text();
            };

            var phoneNumber = `Telefone: (${get(0)}) ${get(1)}${get(2).length ? "#" + get(2) : ""} - ${titleCase(get(4))}`;
            phones.append($("<li />").text(phoneNumber));
        });

        var emails = $("<ul />").addClass("emails");
        $("company > email > node", element).each((idx, node) => {
            var emailAddress = `E-mail: ${$("node:eq(0)", node).text()} - ${titleCase($("node:eq(1)", node).text())}`;
            emails.append($("<li />").text(emailAddress));
        });

        var get = (idx) => {
            return $(`endereco node:eq(${idx.toString()})`, element).text();
        };

        var address = `${get(0)} ${get(1)} ${get(2)} ${get(3)} - ${get(5)} ${get(4)} ${get(6)} `;

        var addressNode = $("<p />").text(address).addClass("address").append($("<a />").attr({
            href: `http\:\/\/maps.google.com\?q\=${encodeURI(address)}`,
            target: '_blank'
        }).append(
            $("<div />").addClass("map").css({
                "background-image": `url(http\:\/\/maps.googleapis.com/maps/api/staticmap?center=${encodeURI(address)}&zoom=13&scale=false&size=600x200&maptype=roadmap&format=png&visual_refresh=true)`
            })
        ));

        paragraph.append(emails).append(phones).append(addressNode);
        return [emails, phones, addressNode];
    };

    controller.registerCall("icheques::antecipate::fidc", (data, element, checks) => {
        var modal = controller.modal();
        modal.gamification("sword").css({
            "background": `url(${$(element).children("logo").text()}) no-repeat center`
        });
        modal.title($("company > nome", element).text() || $("company > responsavel", element).text());
        modal.subtitle($("company > cnpj", element).text() || $("company > cpf", element).text());
        var paragraph = modal.paragraph($(element).children("bio").text());

        companyData(paragraph, element);

        var form = modal.createForm();
        form.addSubmit("send", "Antecipar");
        form.element().submit((e) => {
            e.preventDefault();
            modal.close();
            controller.call("confirm", {
                title: "Você deseja realmente antecipar estes títulos?",
                subtitle: "Será enviado um e-mail para factoring solicitando aprovação.",
                paragraph: "Os cheques não poderão serem processados novamente, você deverá aguardar a aprovação ou rejeição. A factoring reserva o direito de aceitar apenas alguns títulos de sua carteira."
            }, () => {
                e.preventDefault();
                controller.serverCommunication.call("INSERT INTO 'ICHEQUES'.'ANTECIPATE'",
                    controller.call("error::ajax", controller.call("loader::ajax", {
                        method: "POST",
                        data: {
                            factoring: $("company > username", element).text(),
                            checks: _.pluck(checks, "cmc").join(",")
                        },
                        success: function() {
                            controller.call("alert", {
                                icon: "pass",
                                title: "Seus cheques foram enviados.",
                                subtitle: "Aguarde a resposta do fundo em seu e-mail.",
                                paragraph: "Os cheques continuarão em sua carteira do iCheques até que a antecipadora de cheques aceite a operação."
                            });
                        }
                    })));
            }, () => {
                controller.call("icheques::antecipate::show", data, checks);
            });
        });

        modal.createActions().cancel(() => {
            controller.call("icheques::antecipate::show", data, checks);
        });
    });

};
