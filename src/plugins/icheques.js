/* global toastr */
(function (controller) {

    $("body").addClass("icheques-extension");

    controller.call("ccbusca::enable");

    controller.confs.iugu.token = "b3ed1c2a-ee7b-47d2-ab4d-7e8fba14e933";
    controller.endpoint.forgotPassword = "SELECT FROM 'ICHEQUESAUTHENTICATION'.'FORGOTPASSWORD'";
    controller.endpoint.adminReport = "SELECT FROM 'ICHEQUESREPORT'.'REPORT'";

    $.extend(controller.confs.icheques, {
        price: 150,
        monthsIncluded: 5,
        moreMonths: 30
    });

    require("./lib/icheques/reference")(controller);
    require("./lib/icheques/welcome")(controller);
    require("./lib/icheques/parser")(controller);
    require("./lib/icheques/new-check")(controller);
    require("./lib/icheques/cmc-reader")(controller);
    require("./lib/icheques/checkout")(controller);
    require("./lib/icheques/create-account")(controller);
    require("./lib/icheques/harlan")(controller);
    require("./lib/icheques/report")(controller);
    require("./lib/icheques/search")(controller);
    require("./lib/icheques/buy-reader")(controller);
    require("./lib/icheques/full-profile")(controller);
    require("./lib/icheques/bank-profile")(controller);
    require("./lib/icheques/antecipate")(controller);
    require("./lib/icheques/contact")(controller);
    require("./lib/icheques/logout")(controller);
    require("./lib/icheques/subaccount")(controller);
    require("./lib/icheques/design")(controller);
    require("./lib/icheques/contract-accept")(controller);
    require("./lib/icheques/edit")(controller);
    require("./lib/icheques/ban-generate")(controller);
    require("./lib/icheques/can-antecipate")(controller);
    require("./lib/icheques/fidc")(controller);
    require("./lib/icheques/ban-url-download")(controller);

    /*
     *  Nada como um nado estilo livre nesse mar
     *  nado de peito que é desse jeito que eu curto nadar
     *  nadar da pedra pra praia, da praia pra pedra,
     *  do canto pro meio, do meio pro canto, do raso pro fundo
     *  do fundo do peito, de dentro da onda
     *  pra fora da linha da arrebentação da ressaca do mundo
     *  alguns segundos só na apnéia
     *  sem respiração, só pra abrir o pulmão e as idéias
     *  só pra sentir saudade do oxigênio
     *  e respirar de novo e me lembrar de que isso é um prêmio

     *  Link: http://www.vagalume.com.br/gabriel-pensador/tempestade.html#ixzz3stkENplW
     */

})(harlan);
