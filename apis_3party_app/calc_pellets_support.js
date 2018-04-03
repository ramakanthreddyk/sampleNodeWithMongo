var mongoose = require('mongoose');
var ObjectId_global = mongoose.Types.ObjectId;
module.exports = function otherproducts(data123, spc, body, ocm_manual, query7, query8, query_quality) {


    var returndata = [];
    if (body.Abladestellen.number > 1) {
        var sammel = body.Abladestellen.number * data123.sammel;
    } else {
        var sammel = 0;
    }

    for (let quality of data123.qualities) {
        if (quality.convert == 'Euro/100l/Tonne') {
            var euro100l = ocm_manual + parseFloat(data123.euro100l_sum) + parseFloat(data123.sellingpoints[query7]) + parseFloat(data123.sellingpoints[query8]) + parseFloat(quality[query_quality]);
            var finalprice_var = (parseFloat(euro100l) * parseFloat(body.Liter.value / 1000)) + parseFloat(sammel) + parseFloat(data123.eurobestellung_sum) + (parseFloat(data123.eurokm_sum) * parseFloat(spc.traveldistance));
        }
        else if (quality.convert == 'Euro/Bestellung') {
            var euro100l = ocm_manual + parseFloat(data123.euro100l_sum) + parseFloat(data123.sellingpoints[query7]) + parseFloat(data123.sellingpoints[query8]);
            var finalprice_var = (parseFloat(euro100l) * parseFloat(body.Liter.value / 1000)) + parseFloat(sammel) + parseFloat(data123.eurobestellung_sum) + parseFloat(quality[query_quality]) + (parseFloat(data123.eurokm_sum) * spc.traveldistance);

        }
        else if (quality.convert == 'Euro/Km') {
            var euro100l = ocm_manual + parseFloat(data123.euro100l_sum) + parseFloat(data123.sellingpoints[query7]) + parseFloat(data123.sellingpoints[query8]);
            var finalprice_var = (parseFloat(euro100l) * parseFloat(body.Liter.value / 1000)) + parseFloat(sammel) + parseFloat(data123.eurobestellung_sum) + (parseFloat(quality[query_quality]) * parseFloat(spc.traveldistance)) + (parseFloat(data123.eurokm_sum) * parseFloat(spc.traveldistance));

        }
        else {
            var euro100l = ocm_manual + parseFloat(data123.euro100l_sum) + parseFloat(data123.sellingpoints[query7]) + parseFloat(data123.sellingpoints[query8]);
            var finalprice_var = (parseFloat(euro100l) * parseFloat(body.Liter.value / 1000)) + parseFloat(sammel) + parseFloat(data123.eurobestellung_sum) + (parseFloat(data123.eurokm_sum) * parseFloat(spc.traveldistance));


        }

        var euro100l_local = ocm_manual + parseFloat(data123.euro100l_sum) + parseFloat(data123.sellingpoints[query7]) + parseFloat(data123.sellingpoints[query8]);
        var finalprice_var_local = (parseFloat(euro100l_local) * parseFloat(body.Liter.value / 1000)) + parseFloat(sammel) + parseFloat(data123.eurobestellung_sum) + (parseFloat(data123.eurokm_sum) * parseFloat(spc.traveldistance));


        var euro_100L_Local = (parseFloat(finalprice_var_local) / parseFloat(body.Liter.value / 1000)).toFixed(2);
        var Final_withouttax_Local = (euro_100L_Local * parseFloat(body.Liter.value / 1000)).toFixed(2);


        var euro_100L = (parseFloat(finalprice_var) / parseFloat(body.Liter.value / 1000)).toFixed(2);
        var Final_withouttax = (euro_100L * parseFloat(body.Liter.value / 1000)).toFixed(2);


        quality.final_100liters_ton = euro_100L;
        quality.finalprice = Final_withouttax;
        quality.tax_for_finalprice = (parseFloat(Final_withouttax * 0.07) + parseFloat(Final_withouttax)).toFixed(2);
        quality.tax_for_100l_ton = (parseFloat(Final_withouttax * 0.07 * parseFloat(1000 / body.Liter.value)) + ((Final_withouttax) / parseFloat(body.Liter.value / 1000))).toFixed(2);
        quality.compareprice = Final_withouttax_Local;
        quality.regio_preis = ocm_manual.toFixed(2);
        quality.regio_marge = ((parseFloat(Final_withouttax) / parseFloat(body.Liter.value / 1000)) - ocm_manual).toFixed(2);
        quality.skb = (ocm_manual + parseFloat(data123.sellingpoints[query7]) + parseFloat(data123.sellingpoints[query8])).toFixed(2);
        quality.skb_marge = ((parseFloat(Final_withouttax) / parseFloat(body.Liter.value / 1000)) - (ocm_manual + parseFloat(data123.sellingpoints[query7]) + parseFloat(data123.sellingpoints[query8]))).toFixed(2);
        quality.regio_marge_full = (parseFloat(Final_withouttax) - parseFloat(ocm_manual * parseFloat(body.Liter.value / 1000))).toFixed(2);
        quality.skb_marge_full = (parseFloat(Final_withouttax) - (parseFloat(ocm_manual * parseFloat(body.Liter.value / 1000)) + parseFloat(data123.sellingpoints[query7]) + parseFloat(data123.sellingpoints[query8]))).toFixed(2);


        quality.Kalkulation_rpi = 'Manuell';

        quality.Verkaufer = data123.sellingpoints['pc_name'];
        quality.Verkaufer_id = data123.sellingpoints['_id'];


        delete quality.onoff;
        delete quality.specialText_show;
        delete quality.calculation;
        delete quality.highlight_pellets;
        delete quality.heatoil_value_show;
        delete quality.diesel_value_show;
        delete quality.benzin_value_show;
        delete quality.select_option;
        delete quality.heatoil_value;
        delete quality.diesel_value;
        delete quality.benzin_value;
        delete quality.pellets_value;
        delete quality.pellets_value_show;
        delete quality.convert;
        returndata.push(quality);
    }


    return returndata;
};