var moment = require('moment');

module.exports = function booking_mail_customer(Unternehmendata, frontEndData, priceDetails, commondata, myDate) {
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
    if (Unternehmendata.email_setup.Logo.data) {
        all_attachments.push({
            filename: Unternehmendata.email_setup.Logo.name,
            content: (Unternehmendata.email_setup.Logo.data).toString('base64'),
            encoding: 'base64',
            cid: 'unique@kreata.ee'

        });
    }
    var Lier_array = '';
    for (let [index, liefer] of frontEndData.lieferAddressArray.addresses.entries()) {

        Lier_array += '<b>Lieferadresse ' + (parseInt(index) + 2) + ':</b><br>Menge: <b>' + liefer.menge + '</b><br>Titel: ' + liefer.gender1 + '</b><br>Vorname: <b>' + liefer.Vorname + '</b><br>Name: <b>' + liefer.Name + '</b><br>Adresszusatz: <b>' + liefer.Addresszusatz + '</b><br>Straße: <b>' + liefer.Strasse + '</b><br>Hausnummer: <b>' + liefer.Hausnummer + '</b><br>PLZ: <b>' + liefer.PLZ + '</b><br>Ort: <b>' + liefer.Ort + '</b><br>Telefon: <b>' + liefer.Telefon + '</b><br><br>';
    }
    if (Unternehmendata.email_setup.Absender && Unternehmendata.email_setup.Email_status == 'Verifiziert') {
        var from_email = Unternehmendata.email_setup.Absender;
    } else {
        var from_email = 'info@aupris.com';
    }

    if (frontEndData.liferAddress.Liefer_address.gender == 'Herr') {
        var greeting = 'geehrter Herr ';
    } else {
        var greeting = 'geehrte Frau ';
    }

    if (frontEndData.bestellung.Produkt.name == 'Heizöl') {
        var subject_data = Unternehmendata.email_setup.SubjectH;
    } else {
        var subject_data = Unternehmendata.email_setup.SubjectP;
    }


    var mailOptions = {
        from: from_email,
        to: frontEndData.liferAddress.Liefer_address.Email_repeat,
        subject: subject_data,
        html: `<b>Sehr ` + greeting + frontEndData.liferAddress.Liefer_address.Vorname + ' ' + frontEndData.liferAddress.Liefer_address.Name + `,</b>
    <br><br>
    <pre style="font-family: Calibri, sans-serif;font-size:14px">`+ Unternehmendata.email_setup.einleitung + `</pre>
    
    Produkt:&nbsp; <b>`+ frontEndData.bestellung.Produkt.name + `</b><br>
    Qualität:&nbsp; <b>`+ priceDetails.name + `</b><br>
    Menge:&nbsp; <b>`+ frontEndData.bestellung.Liter.value + `</b><br>
    Abladestellen:&nbsp; <b>`+ frontEndData.bestellung.Abladestellen.number + `</b><br>
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
    <pre style="font-family: Calibri, sans-serif;font-size:14px">`+ Unternehmendata.email_setup.Schlusnote + `</pre><br>
    <pre style="font-family: Calibri, sans-serif;font-size:14px">Diese Email wurde automatisch generiert.</pre><br>
    <pre style="font-family: Calibri, sans-serif;font-size:14px">`+ Unternehmendata.email_setup.emailSign + `<br>` + '<img  src="cid:unique@kreata.ee"/>' + `
    </pre><br>
    <pre style="font-family: Calibri, sans-serif;font-size:14px">`+ Unternehmendata.email_setup.hinweise + `</pre>
    `,
        attachments: all_attachments
    };

    return mailOptions;

}