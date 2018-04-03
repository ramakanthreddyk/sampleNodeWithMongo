var mongoose = require('mongoose');
var ObjectId = mongoose.Types.ObjectId;
module.exports = function bookingData_insert(Unternehmendata, frontEndData, priceDetails, newdate) {
    if (frontEndData.bestellung.Schlauchlange.name != '') {
        var schauchlange = frontEndData.bestellung.Schlauchlange.name
    }
    else {
        var schauchlange = frontEndData.bestellung.Schlauchlange_pellets.name
    }
    let data = {
        MyMasterId: ObjectId(Unternehmendata.MyMasterId),
        unternehmenId: ObjectId(Unternehmendata._id),
        date: new Date(newdate),
        vertrieb: 'Web',
        test: frontEndData.test,
        unternehmen_name: Unternehmendata.unter_name,
        verkaufer: {
            firstname: '',
            lastname: '',
        },
        priceDetails: priceDetails,
        orderDetails: {
            Produkt: frontEndData.bestellung.Produkt.name,
            Lieferort: frontEndData.bestellung.Lieferort.title,
            Liter: frontEndData.bestellung.Liter.value,
            Abladestellen: frontEndData.bestellung.Abladestellen.number,
            Liefertermin: frontEndData.bestellung.Liefertermin.name,
            Lieferzeiten: frontEndData.bestellung.Lieferzeiten.name,
            Tankwagen: frontEndData.bestellung.Tankwagen.name,
            Schlauchlange: schauchlange,
            Zahlungsart: frontEndData.bestellung.Zahlungsart.name,
        },
        lieferAddress: frontEndData.liferAddress.Liefer_address,
        AdditionalAddresses: frontEndData.lieferAddressArray.addresses,
        rechnungAddress: frontEndData.rechnungAddress.Rechnung_address,
    }
    return data;

};