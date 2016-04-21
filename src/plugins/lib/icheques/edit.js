import {
    CMC7Parser
} from "./cmc7-parser.js";

module.exports = function(controller) {

    controller.registerCall("icheques::item::add::time", (check) => {
        controller.call("confirm", {
            icon: "reload",
            title: "Mais um mês de monitoramento.",
            subtitle: "Confirme que deseja adicionar mais 30 dias de monitoramento.",
            paragraph: "Ao custo de R$ 1,50 (um real e cinquenta centavos) monitore por mais 30 dias seus cheque e fique seguro na hora de depositar."
        }, () => {
            controller.call("credits::has", 150, () => {
                controller.serverCommunication.call("UPDATE 'ICHEQUES'.'ONEMONTH'",
                    controller.call("error::ajax", controller.call("loader::ajax", {
                    data: check,
                    success: () => {
                        /* websocket updates =p */
                        toastr.success("Um mês adicionado ao vencimento com sucesso.", "Dados atualizados com sucesso.");
                    }
                }, true)));
            });
        });
    });

    controller.registerCall("icheques::item::edit", function(check) {
        var cmc7Data = new CMC7Parser(check.cmc),
            form = controller.call("form", (parameters) => {
                parameters.cmc = check.cmc;
                controller.call("confirm", {}, () => {
                    controller.serverCommunication.call("UPDATE 'ICHEQUES'.'CHECKDATA'",
                        controller.call("error::ajax", controller.call("loader::ajax", {
                            data: parameters,
                            success: () => {
                                /* websocket updates =p */
                                toastr.success("Os dados do cheque foram atualizados com sucesso.", "Dados atualizados com sucesso.");
                            }
                        }, true)));
                });
            });

        form.configure({
            title: "Edição de Cheque",
            subtitle: "Correção e inserção de dados do cheque.",
            gamification: "magicWand",
            paragraph: `É muito importante que os dados do cheque <strong class="break">${check.cmc}</strong> estejam corretos para que seja mantido um cadastro saneado.`,
            screens: [{
                nextButton: "Alterar Dados",
                magicLabel: true,
                fields: [
                    [{
                        name: "check-number",
                        type: "text",
                        placeholder: "Número do Cheque",
                        labelText: "Número do Cheque",
                        disabled: true,
                        value: cmc7Data.number,
                    }, {
                        name: "ammount",
                        type: "text",
                        placeholder: "Valor do Cheque",
                        labelText: "Valor do Cheque",
                        value: check.ammount,
                        mask: "000.000.000.000,00",
                        required: false,
                        maskOptions: {
                            reverse: true
                        },
                        numeral: true

                    }], {
                        name: "observation",
                        type: "textarea",
                        placeholder: "Observação",
                        labelText: "Observação",
                        required: false,
                        value: check.observation
                    }
                ]
            }]
        });
    });
};
