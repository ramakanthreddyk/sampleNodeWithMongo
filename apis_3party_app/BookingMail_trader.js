var moment = require('moment-timezone');
moment().tz("Europe/Berlin").format();

module.exports = function booking_mail(Unternehmendata, frontEndData, priceDetails, commondata, myDate) {
    if (frontEndData.bestellung.Schlauchlange.name != '') {
        var schauchlange = frontEndData.bestellung.Schlauchlange.name
    }
    else {
        var schauchlange = frontEndData.bestellung.Schlauchlange_pellets.name
    }
    var all_attachments = [];

    var rechnungAddress_object = {}

    if (frontEndData.rechnungAddress.Rechnung_address.rechnung) {
        var rechnungAddress_object = frontEndData.rechnungAddress.Rechnung_address;
    } else {
        var rechnungAddress_object = frontEndData.liferAddress.Liefer_address;
    }

    if (Unternehmendata.email_setup.pdf.data) {
        all_attachments.push({
            filename: Unternehmendata.email_setup.pdf.name,
            content: (Unternehmendata.email_setup.pdf.data).toString('base64'),
            encoding: 'base64',
            contentType: Unternehmendata.email_setup.pdf.mimetype
        });
    }

    if (Unternehmendata.email_setup.pdf1.data) {
        all_attachments.push({
            filename: Unternehmendata.email_setup.pdf1.name,
            content: (Unternehmendata.email_setup.pdf1.data).toString('base64'),
            encoding: 'base64',
            contentType: Unternehmendata.email_setup.pdf1.mimetype
        });
    }

    if (Unternehmendata.email_setup.pdf2.data) {
        all_attachments.push({
            filename: Unternehmendata.email_setup.pdf2.name,
            content: (Unternehmendata.email_setup.pdf2.data).toString('base64'),
            encoding: 'base64',
            contentType: Unternehmendata.email_setup.pdf2.mimetype
        });
    }
    var Lier_array = '';
    for (let [index, liefer] of frontEndData.lieferAddressArray.addresses.entries()) {

        Lier_array += '<b>Lieferadresse ' + (parseInt(index) + 2) + ':</b><br>Mange: <b>' + liefer.menge + '</b><br>Titel: ' + liefer.gender1 + '</b><br>Vorname: <b>' + liefer.Vorname + '</b><br>Name: <b>' + liefer.Name + '</b><br>Adresszusatz: <b>' + liefer.Addresszusatz + '</b><br>Straße: <b>' + liefer.Strasse + '</b><br>Hausnummer: <b>' + liefer.Hausnummer + '</b><br>PLZ: <b>' + liefer.PLZ + '</b><br>Ort: <b>' + liefer.Ort + '</b><br>Telefon: <b>' + liefer.Telefon + '</b><br><br>';
    }
    if (Unternehmendata.email_setup.Posteingang) {
        var to_eamil = Unternehmendata.email_setup.Posteingang;
    } else {
        var to_eamil = 'info@aupris.com';
    }


    var mailOptions = {
        from: 'info@aupris.com',
        to: to_eamil,
        subject: frontEndData.bestellung.Produkt.name,
        html: `<b>Sehr geehrter Händler,</b>
    <br><br>
    Folgende Bestellung wurde über Aupris erfasst:<br>
    Datum: &nbsp;<b>`+ moment(myDate).format("DD.MM.YYYY") + `</b><br>
    Uhrzeit:&nbsp; <b>`+ moment(myDate).format("HH:mm") + `</b><br>
    Vertriebskanal:&nbsp; Web<br>
    Verkäufer: &nbsp;`+ ' ' + `<br>
    Trade ID:&nbsp; <b>`+ commondata.Knr + `</b><br><br>


    Produkt:&nbsp; <b>`+ frontEndData.bestellung.Produkt.name + `</b><br>
    Qualität:&nbsp; <b>`+ priceDetails.name + `</b><br>
    Menge:&nbsp; <b>`+ frontEndData.bestellung.Liter.value + `</b><br><br>

    Unternehmen:&nbsp; <b>`+ Unternehmendata.unter_name + `</b><br>
    Verkaufszentrum:&nbsp; <b>`+ priceDetails.Verkaufer + `</b><br><br>

    Preis 100l (netto):&nbsp; <b>`+ priceDetails.final_100liters_ton + `</b><br>
    Preis 100l (brutto):&nbsp; <b>`+ priceDetails.tax_for_100l_ton + `</b><br><br>

    Gesamtpreis (netto)&nbsp; <b>`+ priceDetails.finalprice + `</b><br>
    Gesamtpreis (brutto)&nbsp; <b>`+ priceDetails.tax_for_finalprice + `</b><br><br>


    Liefertermin:&nbsp; <b>`+ frontEndData.bestellung.Liefertermin.name + `</b><br>
    Lieferzeit:&nbsp; <b>`+ frontEndData.bestellung.Lieferzeiten.name + `</b><br>
    Tankwagen:&nbsp; <b>`+ frontEndData.bestellung.Tankwagen.name + `</b><br>
    Schlauchlänge:&nbsp; <b>`+ schauchlange + `</b><br>
    Zahlungsart: &nbsp;<b>`+ frontEndData.bestellung.Zahlungsart.name + `</b><br><br>

    Anmerkungen: &nbsp;<b>`+ frontEndData.liferAddress.Liefer_address.Zusatzliche + `</b><br><br>


    <b>Rechnungsadresse:</b><br>
    Firma:&nbsp; <b>`+ rechnungAddress_object.Firma + `</b><br>
    Titel:&nbsp; <b>`+ rechnungAddress_object.gender + `</b><br>
    Vorname:&nbsp; <b>`+ rechnungAddress_object.Vorname + `</b><br>
    Name:&nbsp; <b>`+ rechnungAddress_object.Name + `</b><br>
    Adresszusatz: &nbsp;<b>`+ rechnungAddress_object.Addresszusatz + `</b><br>
    Straße: &nbsp;<b>`+ rechnungAddress_object.Strasse + `</b><br>
    Hausnummer: &nbsp;<b>`+ rechnungAddress_object.Hausnummer + `</b><br>
    PLZ: &nbsp;<b>`+ rechnungAddress_object.PLZ + `</b><br>
    Ort: &nbsp;<b>`+ rechnungAddress_object.Ort + `</b><br>
    Telefon: &nbsp;<b>`+ rechnungAddress_object.Telefon + `</b><br>
    Email: &nbsp;<b>`+ rechnungAddress_object.Email + `</b><br>
    Kundennummer: &nbsp;<b>`+ rechnungAddress_object.Kundennummer + `</b><br><br>

    Anmerkungen: &nbsp;<b>`+ rechnungAddress_object.Zusatzliche + `</b><br><br>



    <b>Lieferadresse 1:</b><br>
    Menge: &nbsp;<b>`+ frontEndData.liferAddress.Liefer_address.menge + `</b><br>
    Firma: &nbsp;<b>`+ frontEndData.liferAddress.Liefer_address.Firma + `</b><br>
    Titel: &nbsp;<b>`+ frontEndData.liferAddress.Liefer_address.gender + `</b><br>
    Vorname: &nbsp;<b>`+ frontEndData.liferAddress.Liefer_address.Vorname + `</b><br>
    Name: &nbsp;<b>`+ frontEndData.liferAddress.Liefer_address.Name + `</b><br>
    Adresszusatz: &nbsp;<b>`+ frontEndData.liferAddress.Liefer_address.Addresszusatz + `</b><br>
    Straße: &nbsp;<b>`+ frontEndData.liferAddress.Liefer_address.Strasse + `</b><br>
    Hausnummer: &nbsp;<b>`+ frontEndData.liferAddress.Liefer_address.Hausnummer + `</b><br>
    PLZ: &nbsp;<b>`+ frontEndData.liferAddress.Liefer_address.PLZ + `</b><br>
    Ort: &nbsp;<b>`+ frontEndData.liferAddress.Liefer_address.Ort + `</b><br>
    Telefon: &nbsp;<b>`+ frontEndData.liferAddress.Liefer_address.Telefon + `</b><br>
    Email: &nbsp;<b>`+ frontEndData.liferAddress.Liefer_address.Email_repeat + `</b><br>
    Kundennummer: &nbsp;<b>`+ frontEndData.liferAddress.Liefer_address.Kundennummer + `</b><br><br>

    `+ Lier_array + `</b><br>
    <pre style="font-family: Calibri, sans-serif;font-size:14px">Diese Email wurde automatisch generiert.</pre>
    <pre style="font-family: Calibri, sans-serif;font-size:14px">Diese Email enthält vertrauliche oder rechtlich 
geschützte Informationen. Wenn Sie nicht der
beabsichtigte Empfänger sind, informieren Sie
bitte sofort den Absender und löschen Sie diese
Email. Das unbefugte Kopieren dieser Email oder
die unbefugte Weitergabe der enthaltenen
Informationen ist nicht gestattet.<br><br>
    
The information contained in this message is
confidential or protected by law. If you are not
the intended recipient, please contact the sender
and delete this message. Any unauthorised copying
of this message or unauthorised distribution of the
information contained herein is prohibited.</pre>
    `,
        attachments: all_attachments
    };

    return mailOptions;

}