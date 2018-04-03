var express = require("express");
var bodyParser = require("body-parser");
var cors = require('cors');
var path = require('path');
var request = require('request');
var mongoDB = require("mongodb");
var mongoose = require('mongoose');
var fs = require('fs');
var https = require('https');
var nodemailer = require('nodemailer');
var passport = require('passport');
var jwt = require('jwt-simple');
var ObjectId_global = mongoose.Types.ObjectId;
var ObjectId = mongoose.Types.ObjectId;
var pelletssupportedfile = require('./apis_3party_app/calc_pellets_support');
var otherproducts = require('./apis_3party_app/calc_others_support');
var booking_mail_customer = require('./apis_3party_app/BookingMail_customer');
var zahlung_mail_trader = require('./apis_3party_app/BookingMail_trader');
var booking_insert = require('./apis_3party_app/bookingData_insert');
var aws = require('aws-sdk');
var moment = require('moment');
var atob = require('atob');
var Blob = require('blob');
var async = require('asyncawait/async');
var await = require('asyncawait/await');

aws.config.loadFromPath('./frontend_app/config/aws_SES.json');
var ses = new aws.SES();

var transporter = nodemailer.createTransport({
    SES: new aws.SES({
        apiVersion: '2010-12-01'
    })
});

var options = {
    key: fs.readFileSync('../localhost_cert/localhost.key'),
    cert: fs.readFileSync('../localhost_cert/localhost.crt')
};

var privateKey = fs.readFileSync('../localhost_cert/localhost.key').toString();
var certificate = fs.readFileSync('../localhost_cert/localhost.crt').toString();


var url ='';// Due to security issues.this can not be shown
var mongoClient = mongoDB.MongoClient;

var app = express();


app.use(cors({ origin: '*' }));

app.get('/', function (req, res) {
    res.send("API's for thirdparty websites connected!!!");
});

var logger = function (req, res, next) {
    let domainName = req.headers['authorization'];
    mongoClient.connect(url, function (err, db) {
        db.collection("unternehmen").aggregate([
            { $project: { _id: 1, domain_links: 1, verkaufburos: 1, MyMasterId: 1, colors: 1, unter_name: 1, email_setup: 1 } },
            { $unwind: "$domain_links" },
            { $project: { "_id": 1, 'domain_links': 1, verkaufburos: 1, MyMasterId: 1, colors: 1, unter_name: 1, email_setup: 1 } },
            { $unwind: "$domain_links" },
            {
                $project: {
                    "_id": 1, verkaufburos: 1, MyMasterId: 1, colors: 1, unter_name: 1, email_setup: 1,
                    matcheddomain: {
                        $cond: {
                            if: { $and: [{ $eq: ["$domain_links.domain", domainName] }] },
                            then: true, else: false
                        }
                    },
                    matcheddomainlink: {
                        $cond: {
                            if: { $and: [{ $eq: ["$domain_links.domain", domainName] }] },
                            then: '$domain_links.link', else: false
                        }
                    }
                }
            },
            { $unwind: "$matcheddomain" },
            { $match: { 'matcheddomain': true } },
            { $project: { "_id": 1, matcheddomain: 1, email_setup: 1, verkaufburos: 1, MyMasterId: 1, matcheddomainlink: 1, colors: 1, unter_name: 1 } },
            {
                $group: {
                    _id: null,
                    first: { $first: "$$ROOT" }
                }
            },
            { $unwind: "$first" },
            { $unwind: "$first.verkaufburos" },
            { $project: { 'first': 1 } },
            {
                $group:
                    {
                        _id: '$first._id',
                        MyMasterId: { '$first': '$first.MyMasterId' },
                        matcheddomain: { '$first': '$first.matcheddomain' },
                        matcheddomainlink: { '$first': '$first.matcheddomainlink' },
                        spcs: { $push: "$first.verkaufburos.spc_id" },
                        colors: { '$first': "$first.colors" },
                        unter_name: { '$first': '$first.unter_name' },
                        email_setup: { '$first': '$first.email_setup' }
                    }
            }
        ],
            function (err, data) {
                if (err || data[0] == 'null' || data[0] == undefined) {
                    res.write(JSON.stringify({ 'success': false, msg: 'no delivery zones! no spcS! did not selected spc in company!', errkind: 'mongoerror' }));
                    res.end();
                    db.close();

                }
                else {
                    res.userdata = data[0];
                    db.close();
                    next();
                }

            });


    });
}

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(logger);

var apiRoutes = express.Router();
var apiBigpc = express.Router();


app.use('/api', apiRoutes);
apiRoutes.use('/bigpc', apiBigpc);


apiRoutes.post('/postalcodes', function (req, res) {
    mongoClient.connect(url, function (err, db) {
        if (err) throw err;
        db.collection('grouping_plz').aggregate([
            { $match: { "MyMasterId": ObjectId_global(res.userdata.MyMasterId) } },
            { $project: { '_id': 1, MyMasterId: 1, plz: 1 } },
            { $unwind: '$plz' },
            { $match: { 'plz.delete': false, 'plz.spc_id': { $in: res.userdata.spcs }, $or: [{ 'plz.place_name': { '$regex': "^" + req.body.event, '$options': 'i' } }, { 'plz.country_code': { '$regex': "^" + req.body.event, '$options': 'i' } }, { 'plz.suburb': { '$regex': "^" + req.body.event, '$options': 'i' } }] } },
            { $project: { 'plz.spc_id': 0, 'plz.latitude': 0, 'plz.longitude': 0, 'plz.delete': 0, 'plz.zone': 0, 'plz.traveldistance': 0 } },
            {
                $group: {
                    _id: '$_id',
                    MyMasterId: { '$first': '$MyMasterId' },
                    plz: { $addToSet: '$plz' }

                }
            }
        ], function (err, dataaa) {
            if (err || dataaa[0] == 'null' || dataaa[0] == undefined) {
                res.write(JSON.stringify({ 'success': false, msg: 'postal code out of reach! delivery zones not calc!', errkind: 'mongoerror' }));
                res.end();
                db.close();
            }
            else {
                res.write(JSON.stringify({ success: true, data: dataaa[0].plz, matcheddomainlink: res.userdata.matcheddomainlink, colors: res.userdata.colors }));
                res.end();
                db.close();
            }
        });
    });
});


apiRoutes.get('/minmax_values', function (req, res) {
    (res.userdata.spcs).map(function (x, i, ar) {
        ar[i] = ObjectId_global(ar[i]);
    });

    mongoClient.connect(url, function (err, db) {
        if (err) throw err;
        db.collection('verkaufsburo').aggregate([
            { $match: { "MyMasterId": ObjectId_global(res.userdata.MyMasterId) } },
            { $project: { 'generalsettings.Basiseinstellungen': 1, 'sellingpoints': 1 } },
            { $unwind: '$generalsettings.Basiseinstellungen' },
            { $match: { "generalsettings.Basiseinstellungen.name": { $in: ['Höchstmenge pro Bestellung in Liter (Heizöl) / Kilogramm (Pellets)', 'Mindestmenge pro Bestellung in Liter (Heizöl) / Kilogramm (Pellets)'] } } },
            {
                $project: {
                    'min.min_heatoil_value': {
                        $cond: {
                            if: { $and: [{ $eq: ["$generalsettings.Basiseinstellungen.name", 'Mindestmenge pro Bestellung in Liter (Heizöl) / Kilogramm (Pellets)'] }] },
                            then: '$generalsettings.Basiseinstellungen.heatoil_value', else: false
                        }
                    },
                    'min.min_diesel_value': {
                        $cond: {
                            if: { $and: [{ $eq: ["$generalsettings.Basiseinstellungen.name", 'Mindestmenge pro Bestellung in Liter (Heizöl) / Kilogramm (Pellets)'] }] },
                            then: '$generalsettings.Basiseinstellungen.diesel_value', else: false
                        }
                    },
                    'min.min_benzin_value': {
                        $cond: {
                            if: { $and: [{ $eq: ["$generalsettings.Basiseinstellungen.name", 'Mindestmenge pro Bestellung in Liter (Heizöl) / Kilogramm (Pellets)'] }] },
                            then: '$generalsettings.Basiseinstellungen.benzin_value', else: false
                        }
                    },
                    'min.min_pellets_value': {
                        $cond: {
                            if: { $and: [{ $eq: ["$generalsettings.Basiseinstellungen.name", 'Mindestmenge pro Bestellung in Liter (Heizöl) / Kilogramm (Pellets)'] }] },
                            then: '$generalsettings.Basiseinstellungen.pellets_value', else: false
                        }
                    },
                    'max.max_heatoil_value': {
                        $cond: {
                            if: { $and: [{ $eq: ["$generalsettings.Basiseinstellungen.name", 'Höchstmenge pro Bestellung in Liter (Heizöl) / Kilogramm (Pellets)'] }] },
                            then: '$generalsettings.Basiseinstellungen.heatoil_value', else: false
                        }
                    },
                    'max.max_diesel_value': {
                        $cond: {
                            if: { $and: [{ $eq: ["$generalsettings.Basiseinstellungen.name", 'Höchstmenge pro Bestellung in Liter (Heizöl) / Kilogramm (Pellets)'] }] },
                            then: '$generalsettings.Basiseinstellungen.diesel_value', else: false
                        }
                    },
                    'max.max_benzin_value': {
                        $cond: {
                            if: { $and: [{ $eq: ["$generalsettings.Basiseinstellungen.name", 'Höchstmenge pro Bestellung in Liter (Heizöl) / Kilogramm (Pellets)'] }] },
                            then: '$generalsettings.Basiseinstellungen.benzin_value', else: false
                        }
                    },
                    'max.max_pellets_value': {
                        $cond: {
                            if: { $and: [{ $eq: ["$generalsettings.Basiseinstellungen.name", 'Höchstmenge pro Bestellung in Liter (Heizöl) / Kilogramm (Pellets)'] }] },
                            then: '$generalsettings.Basiseinstellungen.pellets_value', else: false
                        }
                    },
                    'sellingpoints': 1
                }
            }, {
                $group: {
                    _id: null,
                    min: { $push: '$min' },
                    max: { $push: '$max' }, 'sellingpoints': { '$first': '$sellingpoints' }
                }
            },
            { $unwind: '$min' },
            { $match: { 'min.min_heatoil_value': { $ne: false } } },
            { $unwind: '$max' },
            { $match: { 'max.max_heatoil_value': { $ne: false } } },
            { $project: { 'min': 1, 'max': 1, '_id': 0, 'sellingpoints': 1 } },
            { $unwind: '$sellingpoints' },
            { $match: { "sellingpoints._id": { $in: res.userdata.spcs } } },
            {
                $project: {
                    'heatoil': { $cond: { if: { $and: [{ $eq: ["$sellingpoints.heatoil_onoff", true] }] }, then: 1, else: 0 } },
                    'pellets': { $cond: { if: { $and: [{ $eq: ["$sellingpoints.pellets_onoff", true] }] }, then: 1, else: 0 } },
                    'min': 1, 'max': 1
                }
            }, {
                $group: {
                    "_id": 0, 'min': { '$first': '$min' }, 'max': { '$first': '$max' }, 'heatoil': { $sum: "$heatoil" }, 'pellets': { $sum: "$pellets" },
                }
            }

        ], function (err, dataaa) {
            if (err || dataaa[0] == 'null' || dataaa[0] == undefined) {
                res.write(JSON.stringify({ 'success': false, msg: 'no delivery zones! no spcS! did not selected spc in company!', errkind: 'mongoerror' }));
                res.end();
                db.close();
            }
            else {
                res.write(JSON.stringify({ success: true, data: dataaa, matcheddomainlink: res.userdata.matcheddomainlink, colors: res.userdata.colors }));
                res.end();
                db.close();
            }
        });
    });
});





/*       Big PC  */



apiBigpc.post('/all_options', function (req, res) {
    mongoClient.connect(url, function (err, db) {
        if (err) throw err;
        db.collection('grouping_plz').aggregate([
            { $match: { "MyMasterId": ObjectId_global(res.userdata.MyMasterId) } },
            { $unwind: '$plz' },
            {
                $match: {
                    $and: [
                        { 'plz._id': req.body.plzid },
                        { 'plz.spc_id': { $in: res.userdata.spcs } }
                    ]
                }
            },
            {
                $group: {
                    _id: '$_id',
                    MyMasterId: { '$first': '$MyMasterId' },
                    plz: { $push: '$plz' }
                }
            }
        ], function (err, dataaa) {
            if (err || dataaa[0] == 'null' || dataaa[0] == undefined) {
                res.write(JSON.stringify({ 'success': false, msg: 'given plz not found!', errkind: 'mongoerror' }));
                res.end();
                db.close();
            }
            else {

                var spc_is = [];
                var spc_travaldistance = [];

                for (let spc of dataaa[0].plz) {
                    spc_is.push(ObjectId_global(spc.spc_id));
                    spc_travaldistance.push(parseFloat(spc.traveldistance));
                }
                Array.min = function (array) {
                    return Math.min.apply(Math, array);
                };
                var min_traveldistance = Array.min(spc_travaldistance);

                switch (req.body.Produkt) {

                    case 'Diesel':
                        var query10 = "$settings.dieselvalue";

                        break;
                    case 'Benzin':

                        var query10 = "$settings.benzinvalue";

                        break;
                    case 'Pellets':

                        var query10 = "$settings.pelletsvalue";

                        break;
                    default:

                        var query10 = "$settings.heatoilvalue";

                        break;
                }

                db.collection('verkaufsburo').aggregate([
                    { $match: { "MyMasterId": ObjectId(res.userdata.MyMasterId) } },

                    { "$unwind": "$sellingpoints" },
                    {
                        $match: {
                            $or: [
                                { 'sellingpoints._id': { $in: spc_is } },

                            ]
                        }
                    },
                    {
                        $project: {
                            'sellingpoints': 1,
                            'generalsettings': 1,
                            items: {
                                $concatArrays: [
                                    '$generalsettings.Schlauchlänge'


                                ]
                            },

                        }
                    },
                    { $group: { '_id': '$_id', items: { '$first': '$items' }, sellingpoints: { '$addToSet': '$sellingpoints' }, sellingpoints123: { '$addToSet': '$sellingpoints' }, generalsettings: { '$first': '$generalsettings' } } },
                    { "$unwind": "$sellingpoints" },
                    { $unwind: '$sellingpoints.selling_p_settings' },
                    { $group: { '_id': '$_id', 'selling_p_settings': { '$addToSet': '$sellingpoints.selling_p_settings' }, items: { '$first': '$items' }, sellingpoints: { '$first': '$sellingpoints123' }, generalsettings: { '$first': '$generalsettings' } } },
                    { "$unwind": "$selling_p_settings" },
                    { $group: { '_id': '$_id', settings: { '$addToSet': '$selling_p_settings' }, items: { '$first': '$items' }, sellingpoints: { '$first': '$sellingpoints' }, generalsettings: { '$first': '$generalsettings' } } },
                    { '$unwind': '$settings' },
                    { '$unwind': '$items' },
                    {
                        $project: {
                            Schlauchlänge:
                                {
                                    $cond: {
                                        if: {
                                            $and: [
                                                { $eq: ["$settings._id", '$items._id'] },
                                                { $eq: [query10, 'on'] }, {
                                                    $or: [{ $eq: ['$items.onoff', 'on'] }, { $eq: ['$items.onoff', 'hide'] }
                                                    ]
                                                },
                                                { $or: [{ $gte: ['$items.MaxKm', min_traveldistance] }, { $eq: ['$items.calculation', "standard"] }, { $eq: ['$items.MaxKm', 0] }] }
                                            ]
                                        }, then: "$items", else: 0
                                    }
                                }, 'sellingpoints': 1, 'generalsettings': 1


                        }
                    },
                    { $group: { '_id': '$_id', Schlauchlänge: { '$addToSet': '$Schlauchlänge' }, 'sellingpoints': { '$first': '$sellingpoints' }, generalsettings: { '$first': '$generalsettings' } } },
                    { "$unwind": "$Schlauchlänge" },
                    { $project: { Schlauchlänge: { $cond: { if: { $eq: ["$Schlauchlänge", 0] }, then: "$deliveryzone_for_id", else: '$Schlauchlänge' } }, 'sellingpoints': 1, 'generalsettings': 1 } },
                    { $group: { "_id": '$_id', 'Schlauchlänge': { '$addToSet': '$Schlauchlänge' }, 'sellingpoints': { '$first': '$sellingpoints' }, generalsettings: { '$first': '$generalsettings' } } },

                    {
                        $project: {
                            'sellingpoints': 1,
                            'generalsettings': 1,
                            'Schlauchlänge': 1,
                            items: {
                                $concatArrays: [
                                    '$generalsettings.Liefertermin'


                                ]
                            }
                        }
                    },
                    {
                        $group: {
                            '_id': '$_id',
                            Schlauchlänge: { '$first': '$Schlauchlänge' },
                            items: { '$first': '$items' },
                            sellingpoints: { '$first': '$sellingpoints' },
                            sellingpoints123: { '$first': '$sellingpoints' },
                            generalsettings: { '$first': '$generalsettings' }
                        }
                    },
                    { "$unwind": "$sellingpoints" },
                    { $unwind: '$sellingpoints.selling_p_settings' },
                    {
                        $group: {
                            '_id': '$_id',
                            Schlauchlänge: { '$first': '$Schlauchlänge' },
                            'selling_p_settings': { '$addToSet': '$sellingpoints.selling_p_settings' },
                            items: { '$first': '$items' }, sellingpoints: { '$first': '$sellingpoints123' },
                            generalsettings: { '$first': '$generalsettings' }
                        }
                    },
                    { "$unwind": "$selling_p_settings" },
                    { $group: { '_id': '$_id', settings: { '$addToSet': '$selling_p_settings' }, items: { '$first': '$items' }, sellingpoints: { '$first': '$sellingpoints' }, generalsettings: { '$first': '$generalsettings' }, Schlauchlänge: { '$first': '$Schlauchlänge' } } },
                    { '$unwind': '$settings' },
                    { '$unwind': '$items' },

                    {
                        $project: {
                            Liefertermin:
                                {
                                    $cond: {
                                        if: {
                                            $and: [
                                                { $eq: ["$settings._id", '$items._id'] },
                                                { $eq: [query10, 'on'] }, {
                                                    $or: [{ $eq: ['$items.onoff', 'on'] }, { $eq: ['$items.onoff', 'hide'] }
                                                    ]
                                                },
                                                { $or: [{ $gte: ['$items.MaxKm', min_traveldistance] }, { $eq: ['$items.calculation', "standard"] }, { $eq: ['$items.MaxKm', 0] }] }
                                            ]
                                        }, then: "$items", else: 0
                                    }
                                }, 'sellingpoints': 1, 'generalsettings': 1, Schlauchlänge: 1


                        }
                    },
                    { $group: { '_id': '$_id', Liefertermin: { '$addToSet': '$Liefertermin' }, 'sellingpoints': { '$first': '$sellingpoints' }, generalsettings: { '$first': '$generalsettings' }, Schlauchlänge: { '$first': '$Schlauchlänge' } } },
                    { "$unwind": "$Liefertermin" },
                    { $project: { Liefertermin: { $cond: { if: { $eq: ["$Liefertermin", 0] }, then: "$deliveryzone_for_id", else: '$Liefertermin' } }, 'sellingpoints': 1, 'generalsettings': 1, Schlauchlänge: 1 } },
                    { $group: { "_id": '$_id', 'Liefertermin': { '$addToSet': '$Liefertermin' }, 'sellingpoints': { '$first': '$sellingpoints' }, generalsettings: { '$first': '$generalsettings' }, Schlauchlänge: { '$first': '$Schlauchlänge' } } },

                    {
                        $project: {
                            'sellingpoints': 1,
                            'generalsettings': 1,
                            'Schlauchlänge': 1,
                            'Liefertermin': 1,
                            items: {
                                $concatArrays: [
                                    '$generalsettings.Lieferzeiten'


                                ]
                            }
                        }
                    },
                    {
                        $group: {
                            '_id': '$_id',
                            Schlauchlänge: { '$first': '$Schlauchlänge' },
                            'Liefertermin': { '$first': '$Liefertermin' },
                            items: { '$first': '$items' }, sellingpoints: { '$first': '$sellingpoints' }, sellingpoints123: { '$first': '$sellingpoints' }, generalsettings: { '$first': '$generalsettings' }
                        }
                    },
                    { "$unwind": "$sellingpoints" },
                    { $unwind: '$sellingpoints.selling_p_settings' },
                    {
                        $group: {
                            '_id': '$_id',
                            Schlauchlänge: { '$first': '$Schlauchlänge' },
                            'Liefertermin': { '$first': '$Liefertermin' },
                            'selling_p_settings': { '$addToSet': '$sellingpoints.selling_p_settings' }, items: { '$first': '$items' }, sellingpoints: { '$first': '$sellingpoints123' }, generalsettings: { '$first': '$generalsettings' }
                        }
                    },
                    { "$unwind": "$selling_p_settings" },
                    { $group: { '_id': '$_id', settings: { '$addToSet': '$selling_p_settings' }, items: { '$first': '$items' }, sellingpoints: { '$first': '$sellingpoints' }, generalsettings: { '$first': '$generalsettings' }, Schlauchlänge: { '$first': '$Schlauchlänge' }, 'Liefertermin': { '$first': '$Liefertermin' } } },
                    { '$unwind': '$settings' },
                    { '$unwind': '$items' },

                    {
                        $project: {
                            Lieferzeiten:
                                {
                                    $cond: {
                                        if: {
                                            $and: [
                                                { $eq: ["$settings._id", '$items._id'] },
                                                { $eq: [query10, 'on'] }, {
                                                    $or: [{ $eq: ['$items.onoff', 'on'] }, { $eq: ['$items.onoff', 'hide'] }
                                                    ]
                                                }
                                            ]
                                        }, then: "$items", else: 0
                                    }
                                }, 'sellingpoints': 1, 'generalsettings': 1, Schlauchlänge: 1, 'Liefertermin': 1


                        }
                    },
                    { $group: { '_id': '$_id', Lieferzeiten: { '$addToSet': '$Lieferzeiten' }, 'sellingpoints': { '$first': '$sellingpoints' }, generalsettings: { '$first': '$generalsettings' }, Schlauchlänge: { '$first': '$Schlauchlänge' }, 'Liefertermin': { '$first': '$Liefertermin' } } },
                    { "$unwind": "$Lieferzeiten" },
                    { $project: { Lieferzeiten: { $cond: { if: { $eq: ["$Lieferzeiten", 0] }, then: "$deliveryzone_for_id", else: '$Lieferzeiten' } }, 'sellingpoints': 1, 'generalsettings': 1, Schlauchlänge: 1, 'Liefertermin': 1 } },
                    { $group: { "_id": '$_id', 'Lieferzeiten': { '$addToSet': '$Lieferzeiten' }, 'sellingpoints': { '$first': '$sellingpoints' }, generalsettings: { '$first': '$generalsettings' }, Schlauchlänge: { '$first': '$Schlauchlänge' }, 'Liefertermin': { '$first': '$Liefertermin' } } },







                    {
                        $project: {
                            'sellingpoints': 1,
                            'generalsettings': 1,
                            'Schlauchlänge': 1,
                            'Liefertermin': 1,
                            'Lieferzeiten': 1,
                            items: {
                                $concatArrays: [
                                    '$generalsettings.Tankwagen'


                                ]
                            }
                        }
                    },
                    {
                        $group: {
                            '_id': '$_id',
                            Schlauchlänge: { '$first': '$Schlauchlänge' },
                            'Liefertermin': { '$first': '$Liefertermin' },
                            'Lieferzeiten': { '$first': '$Lieferzeiten' },
                            items: { '$first': '$items' },
                            sellingpoints: { '$first': '$sellingpoints' },
                            sellingpoints123: { '$first': '$sellingpoints' },
                            generalsettings: { '$first': '$generalsettings' }
                        }
                    },
                    { "$unwind": "$sellingpoints" },
                    { $unwind: '$sellingpoints.selling_p_settings' },
                    {
                        $group: {
                            '_id': '$_id',
                            Schlauchlänge: { '$first': '$Schlauchlänge' },
                            'Liefertermin': { '$first': '$Liefertermin' },
                            'Lieferzeiten': { '$first': '$Lieferzeiten' },
                            'selling_p_settings': { '$addToSet': '$sellingpoints.selling_p_settings' }, items: { '$first': '$items' }, sellingpoints: { '$first': '$sellingpoints123' }, generalsettings: { '$first': '$generalsettings' }
                        }
                    },
                    { "$unwind": "$selling_p_settings" },
                    { $group: { '_id': '$_id', settings: { '$addToSet': '$selling_p_settings' }, items: { '$first': '$items' }, sellingpoints: { '$first': '$sellingpoints' }, generalsettings: { '$first': '$generalsettings' }, Schlauchlänge: { '$first': '$Schlauchlänge' }, 'Liefertermin': { '$first': '$Liefertermin' }, 'Lieferzeiten': { '$first': '$Lieferzeiten' } } },
                    { '$unwind': '$settings' },
                    { '$unwind': '$items' },

                    {
                        $project: {
                            Tankwagen:
                                {
                                    $cond: {
                                        if: {
                                            $and: [
                                                { $eq: ["$settings._id", '$items._id'] },
                                                { $eq: [query10, 'on'] }, {
                                                    $or: [{ $eq: ['$items.onoff', 'on'] }, { $eq: ['$items.onoff', 'hide'] }
                                                    ]
                                                }]
                                        }, then: "$items", else: 0
                                    }
                                }, 'sellingpoints': 1, 'generalsettings': 1, Schlauchlänge: 1, 'Liefertermin': 1, 'Lieferzeiten': 1


                        }
                    },
                    { $group: { '_id': '$_id', Tankwagen: { '$addToSet': '$Tankwagen' }, 'sellingpoints': { '$first': '$sellingpoints' }, generalsettings: { '$first': '$generalsettings' }, Schlauchlänge: { '$first': '$Schlauchlänge' }, 'Liefertermin': { '$first': '$Liefertermin' }, 'Lieferzeiten': { '$first': '$Lieferzeiten' } } },
                    { "$unwind": "$Tankwagen" },
                    { $project: { Tankwagen: { $cond: { if: { $eq: ["$Tankwagen", 0] }, then: "$deliveryzone_for_id", else: '$Tankwagen' } }, 'sellingpoints': 1, 'generalsettings': 1, Schlauchlänge: 1, 'Liefertermin': 1, 'Lieferzeiten': 1 } },
                    { $group: { "_id": '$_id', 'Tankwagen': { '$addToSet': '$Tankwagen' }, 'sellingpoints': { '$first': '$sellingpoints' }, generalsettings: { '$first': '$generalsettings' }, Schlauchlänge: { '$first': '$Schlauchlänge' }, 'Liefertermin': { '$first': '$Liefertermin' }, 'Lieferzeiten': { '$first': '$Lieferzeiten' } } },




                    {
                        $project: {
                            'sellingpoints': 1,
                            'generalsettings': 1,
                            'Schlauchlänge': 1,
                            'Liefertermin': 1,
                            'Lieferzeiten': 1,
                            'Tankwagen': 1,
                            items: {
                                $concatArrays: [
                                    '$generalsettings.Zahlungsart'


                                ]
                            }
                        }
                    },
                    {
                        $group: {
                            '_id': '$_id',
                            Schlauchlänge: { '$first': '$Schlauchlänge' },
                            'Liefertermin': { '$first': '$Liefertermin' }, 'Lieferzeiten': { '$first': '$Lieferzeiten' },
                            'Tankwagen': { '$first': '$Tankwagen' },
                            items: { '$first': '$items' },
                            sellingpoints: { '$first': '$sellingpoints' },
                            sellingpoints123: { '$first': '$sellingpoints' },
                            generalsettings: { '$first': '$generalsettings' }
                        }
                    },
                    { "$unwind": "$sellingpoints" },
                    { $unwind: '$sellingpoints.selling_p_settings' },
                    {
                        $group: {
                            '_id': '$_id',
                            Schlauchlänge: { '$first': '$Schlauchlänge' },
                            'Liefertermin': { '$first': '$Liefertermin' },
                            'Lieferzeiten': { '$first': '$Lieferzeiten' },
                            'Tankwagen': { '$first': '$Tankwagen' },
                            'selling_p_settings': { '$addToSet': '$sellingpoints.selling_p_settings' }, items: { '$first': '$items' }, sellingpoints: { '$first': '$sellingpoints123' }, generalsettings: { '$first': '$generalsettings' }
                        }
                    },
                    { "$unwind": "$selling_p_settings" },
                    {
                        $group: {
                            '_id': '$_id',
                            settings: { '$addToSet': '$selling_p_settings' },
                            items: { '$first': '$items' }, sellingpoints: { '$first': '$sellingpoints' },
                            generalsettings: { '$first': '$generalsettings' }, Schlauchlänge: { '$first': '$Schlauchlänge' },
                            'Liefertermin': { '$first': '$Liefertermin' }, 'Lieferzeiten': { '$first': '$Lieferzeiten' },
                            'Tankwagen': { '$first': '$Tankwagen' }

                        }
                    },
                    { '$unwind': '$settings' },
                    { '$unwind': '$items' },

                    {
                        $project: {
                            Zahlungsart:
                                {
                                    $cond: {
                                        if: {
                                            $and: [
                                                { $eq: ["$settings._id", '$items._id'] },
                                                { $eq: [query10, 'on'] }, {
                                                    $or: [{ $eq: ['$items.onoff', 'on'] }, { $eq: ['$items.onoff', 'hide'] }
                                                    ]
                                                }]
                                        }, then: "$items", else: 0
                                    }
                                }, 'sellingpoints': 1, 'generalsettings': 1, Schlauchlänge: 1, 'Liefertermin': 1, 'Lieferzeiten': 1, 'Tankwagen': 1


                        }
                    },
                    {
                        $group:
                            {
                                '_id': '$_id',
                                Zahlungsart: { '$addToSet': '$Zahlungsart' },
                                'sellingpoints': { '$first': '$sellingpoints' },
                                generalsettings: { '$first': '$generalsettings' },
                                Schlauchlänge: { '$first': '$Schlauchlänge' },
                                'Liefertermin': { '$first': '$Liefertermin' },
                                'Lieferzeiten': { '$first': '$Lieferzeiten' },
                                'Tankwagen': { '$first': '$Tankwagen' }

                            }
                    },
                    { "$unwind": "$Zahlungsart" },
                    {
                        $project: {
                            Zahlungsart: { $cond: { if: { $eq: ["$Zahlungsart", 0] }, then: "$deliveryzone_for_id", else: '$Zahlungsart' } },
                            'sellingpoints': 1,
                            'generalsettings': 1,
                            Schlauchlänge: 1,
                            'Liefertermin': 1,
                            'Lieferzeiten': 1,
                            'Tankwagen': 1
                        }
                    },
                    {
                        $group: {
                            "_id": '$_id',
                            'Zahlungsart': { '$addToSet': '$Zahlungsart' },
                            'sellingpoints': { '$first': '$sellingpoints' },
                            generalsettings: { '$first': '$generalsettings' },
                            Schlauchlänge: { '$first': '$Schlauchlänge' },
                            'Liefertermin': { '$first': '$Liefertermin' },
                            'Lieferzeiten': { '$first': '$Lieferzeiten' },
                            'Tankwagen': { '$first': '$Tankwagen' }
                        }
                    },






                    {
                        $project: {
                            'sellingpoints': 1,
                            'generalsettings': 1,
                            'Schlauchlänge': 1,
                            'Liefertermin': 1,
                            'Lieferzeiten': 1,
                            'Tankwagen': 1,
                            'Zahlungsart': 1,
                            items: {
                                $concatArrays: [
                                    '$generalsettings.Schlauchlänge_pellets'


                                ]
                            }
                        }
                    },

                    {
                        $group: {
                            '_id': '$_id', Schlauchlänge: { '$first': '$Schlauchlänge' },
                            'Liefertermin': { '$first': '$Liefertermin' }, 'Lieferzeiten': { '$first': '$Lieferzeiten' },
                            'Tankwagen': { '$first': '$Tankwagen' },
                            'Zahlungsart': { '$first': '$Zahlungsart' },
                            items: { '$first': '$items' }, sellingpoints: { '$first': '$sellingpoints' },
                            sellingpoints123: { '$first': '$sellingpoints' },
                            generalsettings: { '$first': '$generalsettings' }
                        }
                    },
                    { "$unwind": "$sellingpoints" },
                    { $unwind: '$sellingpoints.selling_p_settings' },
                    {
                        $group: {
                            '_id': '$_id', Schlauchlänge: { '$first': '$Schlauchlänge' },
                            'Liefertermin': { '$first': '$Liefertermin' }, 'Lieferzeiten': { '$first': '$Lieferzeiten' },
                            'Tankwagen': { '$first': '$Tankwagen' },
                            'Zahlungsart': { '$first': '$Zahlungsart' },
                            'selling_p_settings': { '$addToSet': '$sellingpoints.selling_p_settings' }, items: { '$first': '$items' }, sellingpoints: { '$first': '$sellingpoints123' }, generalsettings: { '$first': '$generalsettings' }
                        }
                    },


                    { "$unwind": "$selling_p_settings" },

                    {
                        $group: {
                            '_id': '$_id',
                            settings: { '$addToSet': '$selling_p_settings' },
                            items: { '$first': '$items' }, sellingpoints: { '$first': '$sellingpoints' },
                            generalsettings: { '$first': '$generalsettings' }, Schlauchlänge: { '$first': '$Schlauchlänge' },
                            'Liefertermin': { '$first': '$Liefertermin' }, 'Lieferzeiten': { '$first': '$Lieferzeiten' },
                            'Tankwagen': { '$first': '$Tankwagen' },
                            'Zahlungsart': { '$first': '$Zahlungsart' },

                        }
                    },

                    { '$unwind': '$settings' },

                    { '$unwind': '$items' },

                    {
                        $project: {
                            Schlauchlänge_pellets:
                                {
                                    $cond: {
                                        if: {
                                            $and: [
                                                { $eq: ["$settings._id", '$items._id'] },
                                                { $eq: [query10, 'on'] }, {
                                                    $or: [{ $eq: ['$items.onoff', 'on'] }, { $eq: ['$items.onoff', 'hide'] }
                                                    ]
                                                },
                                                { $or: [{ $gte: ['$items.MaxKm', min_traveldistance] }, { $eq: ['$items.calculation', "standard"] }] }
                                            ]
                                        }, then: "$items", else: 0
                                    }
                                }, 'sellingpoints': 1, 'generalsettings': 1, Schlauchlänge: 1, 'Liefertermin': 1, 'Lieferzeiten': 1, 'Tankwagen': 1,
                            'Zahlungsart': 1,


                        }
                    },

                    {
                        $group:
                            {
                                '_id': '$_id',
                                Schlauchlänge_pellets: { '$addToSet': '$Schlauchlänge_pellets' },
                                'sellingpoints': { '$first': '$sellingpoints' },
                                generalsettings: { '$first': '$generalsettings' },
                                Schlauchlänge: { '$first': '$Schlauchlänge' },
                                'Liefertermin': { '$first': '$Liefertermin' },
                                'Lieferzeiten': { '$first': '$Lieferzeiten' },
                                'Tankwagen': { '$first': '$Tankwagen' },
                                'Zahlungsart': { '$first': '$Zahlungsart' },

                            }
                    },

                    { "$unwind": "$Schlauchlänge_pellets" },

                    {
                        $project: {
                            Schlauchlänge_pellets: { $cond: { if: { $eq: ["$Schlauchlänge_pellets", 0] }, then: "$deliveryzone_for_id", else: '$Schlauchlänge_pellets' } },
                            'sellingpoints': 1,
                            'generalsettings': 1,
                            Schlauchlänge: 1,
                            'Liefertermin': 1,
                            'Lieferzeiten': 1,
                            'Tankwagen': 1,
                            'Zahlungsart': 1
                        }
                    },

                    {
                        $group: {
                            "_id": '$_id',
                            'Schlauchlänge_pellets': { '$addToSet': '$Schlauchlänge_pellets' },
                            'sellingpoints': { '$first': '$sellingpoints' },
                            generalsettings: { '$first': '$generalsettings' },
                            Schlauchlänge: { '$first': '$Schlauchlänge' },
                            'Liefertermin': { '$first': '$Liefertermin' },
                            'Lieferzeiten': { '$first': '$Lieferzeiten' },
                            'Tankwagen': { '$first': '$Tankwagen' },
                            'Zahlungsart': { '$first': '$Zahlungsart' },
                        }
                    },





                    {
                        $project: {
                            'sellingpoints': 1,
                            'generalsettings': 1,
                            'Schlauchlänge': 1,
                            'Liefertermin': 1,
                            'Lieferzeiten': 1,
                            'Tankwagen': 1,
                            'Zahlungsart': 1,
                            'Schlauchlänge_pellets': 1,
                            items: {
                                $concatArrays: [
                                    '$generalsettings.Sammelbestellung'


                                ]
                            }
                        }
                    },

                    {
                        $group: {
                            '_id': '$_id',
                            items: { '$first': '$items' },
                            sellingpoints: { '$first': '$sellingpoints' },
                            sellingpoints123: { '$first': '$sellingpoints' },
                            generalsettings: { '$first': '$generalsettings' },
                            Schlauchlänge: { '$first': '$Schlauchlänge' },
                            'Liefertermin': { '$first': '$Liefertermin' }, 'Lieferzeiten': { '$first': '$Lieferzeiten' },
                            'Tankwagen': { '$first': '$Tankwagen' },
                            'Zahlungsart': { '$first': '$Zahlungsart' },
                            'Schlauchlänge_pellets': { '$first': '$Schlauchlänge_pellets' }
                        }

                    },
                    { "$unwind": "$sellingpoints" },
                    { $unwind: '$sellingpoints.selling_p_settings' },
                    {
                        $group: {
                            '_id': '$_id',
                            'selling_p_settings': { '$addToSet': '$sellingpoints.selling_p_settings' },
                            items: { '$first': '$items' },
                            sellingpoints: { '$first': '$sellingpoints123' },
                            generalsettings: { '$first': '$generalsettings' },
                            Schlauchlänge: { '$first': '$Schlauchlänge' },
                            'Liefertermin': { '$first': '$Liefertermin' }, 'Lieferzeiten': { '$first': '$Lieferzeiten' },
                            'Tankwagen': { '$first': '$Tankwagen' },
                            'Zahlungsart': { '$first': '$Zahlungsart' },
                            'Schlauchlänge_pellets': { '$first': '$Schlauchlänge_pellets' }
                        }
                    },

                    { "$unwind": "$selling_p_settings" },

                    {
                        $group: {
                            '_id': '$_id',
                            settings: { '$addToSet': '$selling_p_settings' },
                            items: { '$first': '$items' }, sellingpoints: { '$first': '$sellingpoints' },
                            generalsettings: { '$first': '$generalsettings' }, Schlauchlänge: { '$first': '$Schlauchlänge' },
                            'Liefertermin': { '$first': '$Liefertermin' }, 'Lieferzeiten': { '$first': '$Lieferzeiten' },
                            'Tankwagen': { '$first': '$Tankwagen' },
                            'Zahlungsart': { '$first': '$Zahlungsart' },
                            'Schlauchlänge_pellets': { '$first': '$Schlauchlänge_pellets' },

                        }
                    },

                    { '$unwind': '$settings' },

                    { '$unwind': '$items' },

                    {
                        $project: {
                            Sammelbestellung:
                                {
                                    $cond: {
                                        if: {
                                            $and: [
                                                { $eq: ["$settings._id", '$items._id'] },
                                                { $eq: [query10, 'on'] }, {
                                                    $or: [{ $eq: ['$items.onoff', 'on'] }, { $eq: ['$items.onoff', 'off'] }
                                                    ]
                                                }]
                                        }, then: "$items", else: 0
                                    }
                                }, 'sellingpoints': 1, 'generalsettings': 1, Schlauchlänge: 1, 'Liefertermin': 1, 'Lieferzeiten': 1, 'Tankwagen': 1,
                            'Zahlungsart': 1,
                            'Schlauchlänge_pellets': 1,


                        }
                    },

                    {
                        $group:
                            {
                                '_id': '$_id',
                                Sammelbestellung: { '$addToSet': '$Sammelbestellung' },
                                'sellingpoints': { '$first': '$sellingpoints' },
                                generalsettings: { '$first': '$generalsettings' },
                                Schlauchlänge: { '$first': '$Schlauchlänge' },
                                'Liefertermin': { '$first': '$Liefertermin' },
                                'Lieferzeiten': { '$first': '$Lieferzeiten' },
                                'Tankwagen': { '$first': '$Tankwagen' },
                                'Zahlungsart': { '$first': '$Zahlungsart' },
                                'Schlauchlänge_pellets': { '$first': '$Schlauchlänge_pellets' },

                            }
                    },

                    { "$unwind": "$Sammelbestellung" },

                    {
                        $project: {
                            Sammelbestellung: { $cond: { if: { $eq: ["$Sammelbestellung", 0] }, then: "$deliveryzone_for_id", else: '$Sammelbestellung' } },
                            'sellingpoints': 1,
                            'generalsettings': 1,
                            Schlauchlänge: 1,
                            'Liefertermin': 1,
                            'Lieferzeiten': 1,
                            'Tankwagen': 1,
                            'Zahlungsart': 1,
                            'Schlauchlänge_pellets': 1,
                        }
                    },

                    {
                        $group: {
                            "_id": '$_id',
                            'Sammelbestellung': { '$addToSet': '$Sammelbestellung' },
                            'Schlauchlange': { '$first': '$Schlauchlänge' },
                            'Liefertermin': { '$first': '$Liefertermin' },
                            'Lieferzeiten': { '$first': '$Lieferzeiten' },
                            'Tankwagen': { '$first': '$Tankwagen' },
                            'Zahlungsart': { '$first': '$Zahlungsart' },
                            'Schlauchlange_pellets': { '$first': '$Schlauchlänge_pellets' },
                        }
                    },

                    { $unwind: '$Lieferzeiten' },
                    { $sort: { 'Lieferzeiten._id': 1 } },
                    {
                        $group: {
                            _id: '$_id',
                            'Lieferzeiten': { $push: '$Lieferzeiten' },
                            'Sammelbestellung': { '$first': '$Sammelbestellung' },
                            'Schlauchlange': { '$first': '$Schlauchlange' },
                            'Liefertermin': { '$first': '$Liefertermin' },
                            'Tankwagen': { '$first': '$Tankwagen' },
                            'Zahlungsart': { '$first': '$Zahlungsart' },
                            'Schlauchlange_pellets': { '$first': '$Schlauchlange_pellets' }
                        }
                    },

                    { $unwind: '$Sammelbestellung' },
                    { $sort: { 'Sammelbestellung._id': 1 } },
                    {
                        $group: {
                            _id: '$_id',
                            'Lieferzeiten': { '$first': '$Lieferzeiten' },
                            'Sammelbestellung': { $push: '$Sammelbestellung' },
                            'Schlauchlange': { '$first': '$Schlauchlange' },
                            'Liefertermin': { '$first': '$Liefertermin' },
                            'Tankwagen': { '$first': '$Tankwagen' },
                            'Zahlungsart': { '$first': '$Zahlungsart' },
                            'Schlauchlange_pellets': { '$first': '$Schlauchlange_pellets' }
                        }
                    },

                    { $unwind: '$Schlauchlange' },
                    { $sort: { 'Schlauchlange._id': 1 } },
                    {
                        $group: {
                            _id: '$_id',
                            'Lieferzeiten': { '$first': '$Lieferzeiten' },
                            'Sammelbestellung': { '$first': '$Sammelbestellung' },
                            'Schlauchlange': { $push: '$Schlauchlange' },
                            'Liefertermin': { '$first': '$Liefertermin' },
                            'Tankwagen': { '$first': '$Tankwagen' },
                            'Zahlungsart': { '$first': '$Zahlungsart' },
                            'Schlauchlange_pellets': { '$first': '$Schlauchlange_pellets' }
                        }
                    },

                    { $unwind: '$Liefertermin' },
                    { $sort: { 'Liefertermin._id': 1 } },
                    {
                        $group: {
                            _id: '$_id',
                            'Lieferzeiten': { '$first': '$Lieferzeiten' },
                            'Sammelbestellung': { '$first': '$Sammelbestellung' },
                            'Schlauchlange': { '$first': '$Schlauchlange' },
                            'Liefertermin': { $push: '$Liefertermin' },
                            'Tankwagen': { '$first': '$Tankwagen' },
                            'Zahlungsart': { '$first': '$Zahlungsart' },
                            'Schlauchlange_pellets': { '$first': '$Schlauchlange_pellets' }
                        }
                    },

                    { $unwind: '$Tankwagen' },
                    { $sort: { 'Tankwagen._id': 1 } },
                    {
                        $group: {
                            _id: '$_id',
                            'Lieferzeiten': { '$first': '$Lieferzeiten' },
                            'Sammelbestellung': { '$first': '$Sammelbestellung' },
                            'Schlauchlange': { '$first': '$Schlauchlange' },
                            'Liefertermin': { '$first': '$Liefertermin' },
                            'Tankwagen': { $push: '$Tankwagen' },
                            'Zahlungsart': { '$first': '$Zahlungsart' },
                            'Schlauchlange_pellets': { '$first': '$Schlauchlange_pellets' }
                        }
                    },

                    { $unwind: '$Zahlungsart' },
                    { $sort: { 'Zahlungsart._id': 1 } },
                    {
                        $group: {
                            _id: '$_id',
                            'Lieferzeiten': { '$first': '$Lieferzeiten' },
                            'Sammelbestellung': { '$first': '$Sammelbestellung' },
                            'Schlauchlange': { '$first': '$Schlauchlange' },
                            'Liefertermin': { '$first': '$Liefertermin' },
                            'Tankwagen': { '$first': '$Tankwagen' },
                            'Zahlungsart': { $push: '$Zahlungsart' },
                            'Schlauchlange_pellets': { '$first': '$Schlauchlange_pellets' }
                        }
                    },

                    { $unwind: '$Schlauchlange_pellets' },
                    { $sort: { 'Schlauchlange_pellets._id': 1 } },
                    {
                        $group: {
                            _id: '$_id',
                            'Lieferzeiten': { '$first': '$Lieferzeiten' },
                            'Sammelbestellung': { '$first': '$Sammelbestellung' },
                            'Schlauchlange': { '$first': '$Schlauchlange' },
                            'Liefertermin': { '$first': '$Liefertermin' },
                            'Tankwagen': { '$first': '$Tankwagen' },
                            'Zahlungsart': { '$first': '$Zahlungsart' },
                            'Schlauchlange_pellets': { $push: '$Schlauchlange_pellets' }
                        }
                    },

                ], function (err, dataoption) {
                    if (err || dataoption[0] == 'null' || dataoption[0] == undefined) {
                        res.write(JSON.stringify({ success: false, msg: 'no options found!', errkind: 'mongoerror' }));
                        res.end();
                        db.close();
                    }
                    else {
                        res.write(JSON.stringify({ success: true, data: dataoption, Lieferort: dataaa[0].plz[0] }));
                        res.end();
                        db.close();
                    }
                });
            }
        });
    });
});




apiBigpc.post('/pricecalculator', function (req, res) {
    calculation(req, res, function (data) {
        res.write(JSON.stringify(data));
        res.end();
    });
});


function manual_ocm(data, product, master_id, callback) {
    mongoClient.connect(url, function (err, db) {
        if (data == 'null' || data == undefined) {
            var data123 = {};
            data123.manual_price_callback_false = true;
            callback(data123);
            db.close();
        } else {

            db.collection('aupris_manual_values').aggregate([
                { $match: { "MyMasterId": ObjectId_global(master_id), '_id': ObjectId_global(data['sellingpoints'][product]) } }
            ], function (err, data) {
                if (err) {
                    let object = { 'success': false, msg: 'mongoerror', errkind: 'mongoerror' }
                    callback(object);
                    db.close();
                }
                else {
                    data.manual_price_callback_false = false;
                    callback(data);
                    db.close();
                }
            });


        }

    });
}


function doRequest(data, product, master_id) {
    return new Promise(resolve => {
        mongoClient.connect(url, function (err, db) {
            if (data == 'null' || data == undefined) {
                var data123 = {};
                data123.manual_price_callback_false = true;
                resolve(data123);
                db.close();
            } else {
                db.collection('aupris_manual_values').aggregate([
                    { $match: { "MyMasterId": ObjectId_global(master_id), '_id': ObjectId_global(data['sellingpoints'][product]) } }
                ], function (err, data) {
                    if (err) {
                        //return (JSON.stringify({ 'success': false, msg: 'mongoerror', errkind: 'mongoerror' }));
                        let object = { 'success': false, msg: 'mongoerror', errkind: 'mongoerror' }
                        resolve(object);
                        db.close();
                    }
                    else {
                        data.manual_price_callback_false = false;
                        resolve(data);
                        db.close();
                    }
                });
            }
        });
    });
}


function calculation(req, res, callback) {
    mongoClient.connect(url, function (err, db) {
        if (err) throw err;
        db.collection('grouping_plz').aggregate([
            { $match: { "MyMasterId": ObjectId_global(res.userdata.MyMasterId) } },
            { $unwind: '$plz' },
            {
                $match: {
                    $and: [
                        { 'plz._id': req.body.Lieferort._id },
                        { 'plz.spc_id': { $in: res.userdata.spcs } }
                    ]
                }
            },
            {
                $group: {
                    _id: '$_id',
                    MyMasterId: { '$first': '$MyMasterId' },
                    plz: { $push: '$plz' }
                }
            }
        ], async function (err, dataaa) {

            db.collection("ocm_every_minute").find().sort({ datum: -1, zeit: -1 }).limit(1).toArray(function (error, ocm_data) {

                var final_pc = [];

                var basicsnone = {
                    heatoil_value: 0,
                    diesel_value: 0,
                    benzin_value: 0,
                    pellets_value: 0
                }

                for (const [index, spc] of dataaa[0].plz.entries()) {
                    switch (req.body.Produkt.name) {

                        case 'diesel':
                            var query1 = 'sellingpoints.diesel_onoff';
                            var query4 = '$euro100l.diesel_value';
                            var query5 = '$eurobestellung.diesel_value';
                            var query6 = '_d_ocm';
                            var query7 = 'pickup_point_dieselvalue';
                            var query8 = 'sellingpoint_dieselvalue';
                            var query9 = "$euro100l.dieselvalue";
                            var query10 = "$eurobestellung.dieselvalue";
                            var quality = '$generalsettings.Qualitätsstufen3';
                            var quality_value = '$sellinpoint_for_quality.dieselvalue';
                            var basics_value = '$sellinpoint_for_basics.dieselvalue';
                            var basics_value_product = "$item_for_basics.diesel_value_show";

                            var sammel_value = '$sellinpoint_for_sammelbestellungen.dieselvalue';
                            var sammel_value_product = "$generalsettings_sammelbestellungen.diesel_value_show";

                            var basics_sum = '$basics.diesel_value';
                            var sammalsum = '$sammel.diesel_value';
                            var match_value = 'item_for_match.dieselvalue';
                            var query_quality = 'diesel_value';

                            var query_new_1 = '$eurokm.diesel_value';
                            var query_new_2 = "$eurokm.dieselvalue";
                            break;
                        case 'benzin':
                            var query1 = 'sellingpoints.benzin_onoff';
                            var query4 = '$euro100l.benzin_value';
                            var query5 = '$eurobestellung.benzin_value';
                            var query6 = '_e5_ocm';
                            var query7 = 'pickup_point_benzinvalue';
                            var query8 = 'sellingpoint_benzinvalue';
                            var query9 = "$euro100l.benzinvalue";
                            var query10 = "$eurobestellung.benzinvalue";
                            var quality = '$generalsettings.Qualitätsstufen2';
                            var quality_value = '$sellinpoint_for_quality.benzinvalue';
                            var basics_value = '$sellinpoint_for_basics.benzinvalue';
                            var basics_value_product = "$item_for_basics.benzin_value_show";

                            var sammel_value = '$sellinpoint_for_sammelbestellungen.benzinvalue';
                            var sammel_value_product = "$generalsettings_sammelbestellungen.benzin_value_show";

                            var basics_sum = '$basics.benzin_value';
                            var sammalsum = '$sammel.benzin_value';
                            var match_value = 'item_for_match.benzinvalue';
                            var query_quality = 'benzin_value';

                            var query_new_1 = '$eurokm.benzin_value';
                            var query_new_2 = "$eurokm.benzinvalue";
                            break;
                        case 'Pellets':
                            var query1 = 'sellingpoints.pellets_onoff';
                            var query4 = '$euro100l.pellets_value';
                            var query5 = '$eurobestellung.pellets_value';
                            var query6 = '_e5_ocm';
                            var query7 = 'pickup_point_pelletsvalue';
                            var query8 = 'sellingpoint_pelletsvalue';
                            var query9 = "$euro100l.pellets_value";
                            var query10 = "$eurobestellung.pelletsvalue";
                            var quality = '$generalsettings.Qualitätsstufen1';
                            var quality_value = '$sellinpoint_for_quality.pelletsvalue';
                            var basics_value = '$sellinpoint_for_basics.pelletsvalue';
                            var basics_value_product = "$item_for_basics.pellets_value_show";

                            var sammel_value = '$sellinpoint_for_sammelbestellungen.pelletsvalue';
                            var sammel_value_product = "$generalsettings_sammelbestellungen.pellets_value_show";

                            var basics_sum = '$basics.pellets_value';
                            var sammalsum = '$sammel.pellets_value';
                            var match_value = 'item_for_match.pelletsvalue';
                            var query_quality = 'pellets_value';

                            var query_new_1 = '$eurokm.pellets_value';
                            var query_new_2 = "$eurokm.pelletsvalue";
                            break;
                        default:
                            var query1 = 'sellingpoints.heatoil_onoff';
                            var query4 = '$euro100l.heatoil_value';
                            var query5 = '$eurobestellung.heatoil_value';
                            var query6 = '_h_ocm';
                            var query7 = 'pickup_point_heatoilvalue';
                            var query8 = 'sellingpoint_heatoilvalue';
                            var query9 = "$euro100l.heatoilvalue";
                            var query10 = "$eurobestellung.heatoilvalue";
                            var quality = '$generalsettings.Qualitätsstufen';
                            var quality_value = '$sellinpoint_for_quality.heatoilvalue';
                            var basics_value = '$sellinpoint_for_basics.heatoilvalue';
                            var basics_value_product = "$item_for_basics.heatoil_value_show";

                            var sammel_value = '$sellinpoint_for_sammelbestellungen.heatoilvalue';
                            var sammel_value_product = "$generalsettings_sammelbestellungen.heatoil_value_show";

                            var basics_sum = '$basics.heatoil_value';
                            var sammalsum = '$sammel.heatoil_value';
                            var match_value = 'item_for_match.heatoilvalue';
                            var query_quality = 'heatoil_value';

                            var query_new_1 = '$eurokm.heatoil_value';
                            var query_new_2 = "$eurokm.heatoilvalue";
                            break;
                    }
                    var query2 = 'deliveryzones.' + spc.spc_id + '.real.' + spc.zone + '.zoneinfo';
                    var query3 = '$deliveryzones.' + spc.spc_id + '.real.' + spc.zone + '.zoneinfo';
                    if (req.body.Abladestellen.number == 1) {
                        var inputarray = [ObjectId(req.body.Liefertermin._id), ObjectId(req.body.Zahlungsart._id), ObjectId(req.body.Lieferzeiten._id), ObjectId(req.body.Tankwagen._id), ObjectId(req.body.Schlauchlange._id)];
                    } else {
                        var inputarray = [ObjectId(req.body.Liefertermin._id), ObjectId(req.body.Zahlungsart._id), ObjectId(req.body.Lieferzeiten._id), ObjectId(req.body.Tankwagen._id), ObjectId(req.body.Schlauchlange._id)];
                    }
                    db.collection('verkaufsburo').aggregate([
                        { $match: { "MyMasterId": ObjectId(res.userdata.MyMasterId) } },

                        { "$unwind": "$sellingpoints" },
                        {
                            $match: {
                                $and: [
                                    { 'sellingpoints._id': { $eq: ObjectId(spc.spc_id) } },
                                    { [query1]: true }

                                ]
                            }
                        },
                        {
                            $project: {
                                'sellingpoints': 1,
                                [query2]: 1,
                                items: {
                                    $concatArrays: ["$generalsettings.Basiseinstellungen",
                                        "$generalsettings.Sammelbestellung", "$generalsettings.Liefertermin",
                                        '$generalsettings.Lieferzeiten',
                                        '$generalsettings.Tankwagen', '$generalsettings.Zahlungsart', '$generalsettings.Schlauchlänge',
                                    ]
                                },
                                qualityitem: { $concatArrays: [quality] }
                            }
                        },
                        {
                            $group: {
                                "_id": '$_id',
                                'sellingpoints': { '$first': '$sellingpoints' },
                                'deliveryzones': { '$push': query3 },
                                'deliveryzone_for_id': { '$first': query3 },
                                'items': { '$first': '$items' },
                                'sellingp_points': { '$first': '$sellingpoints.selling_p_settings' },
                                'items2': { '$first': '$items' },
                                'items3': { '$first': '$items' },
                                'items4': { '$first': '$items' },
                                'item_forquality': { '$first': '$qualityitem' },
                                'sellinpoint_for_quality': { '$first': '$sellingpoints.selling_p_settings' },
                                'item_for_match': { '$first': '$sellingpoints.selling_p_settings' },
                                'sellinpoint_for_sammelbestellungen': { '$first': '$sellingpoints.selling_p_settings' },
                                'generalsettings_sammelbestellungen': { '$first': '$items' }
                            }
                        },



                        { $unwind: '$generalsettings_sammelbestellungen' },
                        { $unwind: '$sellinpoint_for_sammelbestellungen' },
                        {
                            $project: {
                                sammel:
                                    {
                                        $cond: {
                                            if: {
                                                $and: [
                                                    { $eq: ["$generalsettings_sammelbestellungen._id", '$sellinpoint_for_sammelbestellungen._id'] },
                                                    { $eq: [sammel_value, 'on'] },
                                                    { $eq: ['$generalsettings_sammelbestellungen.onoff', 'on'] },
                                                    { $eq: ['$generalsettings_sammelbestellungen.name', 'Aufschlag Sammelbestellungen pro Abladestelle'] },
                                                    { $eq: [sammel_value_product, 'yes'] }
                                                ]
                                            }, then: "$generalsettings_sammelbestellungen", else: basicsnone
                                        }
                                    },
                                'sellingpoints': 1,
                                'deliveryzones': 1,
                                'deliveryzone_for_id': 1,
                                'items': 1,
                                'sellingp_points': 1,
                                'items2': 1,
                                'items3': 1,
                                'item_forquality': 1,
                                'sellinpoint_for_quality': 1,
                                'item_for_match': 1,
                                'items4': 1,
                            }
                        },
                        {
                            $group: {
                                "_id": '$_id',
                                'sellingpoints': { '$first': '$sellingpoints' },
                                'deliveryzones': { '$first': '$deliveryzones' },
                                'deliveryzone_for_id': { '$first': '$deliveryzone_for_id' },
                                'items': { '$first': '$items' },
                                'sellingp_points': { '$first': '$sellingp_points' },
                                'items2': { '$first': '$items2' },
                                'items3': { '$first': '$items3' },
                                'item_forquality': { '$first': '$item_forquality' },
                                'sellinpoint_for_quality': { '$first': '$sellinpoint_for_quality' },
                                'item_for_match': { '$first': '$item_for_match' },
                                'items4': { '$first': '$items4' },
                                'sammel': { '$addToSet': '$sammel' },
                            }
                        },




                        { $unwind: '$items4' },
                        {
                            $match: { 'items4._id': { $in: inputarray } },
                        },
                        {
                            $match: { 'items4.onoff': { $ne: 'off' } },
                        },
                        {
                            $group: {
                                "_id": '$_id',
                                'sellingpoints': { '$first': '$sellingpoints' },
                                'deliveryzones': { '$first': '$deliveryzones' },
                                'deliveryzone_for_id': { '$first': '$deliveryzone_for_id' },
                                'items': { '$first': '$items' },
                                'sellingp_points': { '$first': '$sellingp_points' },
                                'items2': { '$first': '$items2' },
                                'items3': { '$first': '$items3' },
                                'item_forquality': { '$first': '$item_forquality' },
                                'sellinpoint_for_quality': { '$first': '$sellinpoint_for_quality' },
                                'item_for_match': { '$first': '$item_for_match' },
                                'sammel': { '$first': '$sammel' }
                            }
                        },
                        { $unwind: '$item_for_match' },
                        {
                            $match: { 'item_for_match._id': { $in: inputarray } },
                        },
                        {
                            $match: { [match_value]: 'on' },
                        },
                        {
                            $group: {
                                "_id": '$_id',
                                'item_for_match': { '$push': '$item_for_match' },
                                'sellingpoints': { '$first': '$sellingpoints' },
                                'deliveryzones': { '$first': '$deliveryzones' },
                                'deliveryzone_for_id': { '$first': '$deliveryzone_for_id' },
                                'items': { '$first': '$items' },
                                'sellingp_points': { '$first': '$sellingp_points' },
                                'items2': { '$first': '$items2' },
                                'items3': { '$first': '$items3' },
                                'item_forquality': { '$first': '$item_forquality' },
                                'sellinpoint_for_quality': { '$first': '$sellingpoints.selling_p_settings' },
                                'item_for_basics': { '$first': '$items' },
                                'sellinpoint_for_basics': { '$first': '$sellingpoints.selling_p_settings' },
                                'sammel': { '$first': '$sammel' }
                            }
                        },
                        { $unwind: '$item_forquality' },
                        { $unwind: '$sellinpoint_for_quality' },
                        {
                            $project: {
                                qualities:
                                    {
                                        $cond: {
                                            if: {
                                                $and: [
                                                    { $eq: ["$item_forquality._id", '$sellinpoint_for_quality._id'] },
                                                    { $eq: [quality_value, 'on'] },
                                                    { $eq: ['$item_forquality.optionedit', 'no'] },
                                                    {
                                                        $or: [{ $eq: ['$item_forquality.onoff', 'on'] }, { $eq: ['$item_forquality.onoff', 'hide'] }
                                                        ]
                                                    }]
                                            }, then: "$item_forquality", else: 0
                                        }
                                    },
                                items: { $concatArrays: ['$deliveryzones', '$items'] },
                                'sellingpoints': 1,
                                'sellingp_points': 1,
                                'deliveryzone_for_id': 1,
                                'items2': 1,
                                'items3': 1,
                                'matched_data_length': { $size: "$item_for_match" },
                                'item_for_basics': 1,
                                'sellinpoint_for_basics': 1,
                                'sammel': 1
                            }
                        },
                        {
                            $group: {
                                "_id": '$_id',
                                'qualities': { '$addToSet': '$qualities' },
                                'sellingpoints': { '$first': '$sellingpoints' },
                                'sellingp_points': { '$first': '$sellingp_points' },
                                'deliveryzone_for_id': { '$first': '$deliveryzone_for_id' },
                                'items2': { '$first': '$items2' },
                                'items3': { '$first': '$items3' },
                                'items': { '$first': '$items' },
                                'matched_data_length': { '$first': '$matched_data_length' },
                                'item_for_basics': { '$first': '$item_for_basics' },
                                'sellinpoint_for_basics': { '$first': '$sellinpoint_for_basics' },
                                'sammel': { '$first': '$sammel' }
                            }
                        },



                        { $unwind: '$item_for_basics' },
                        { $unwind: '$sellinpoint_for_basics' },
                        {
                            $project: {
                                basics:
                                    {
                                        $cond: {
                                            if: {
                                                $and: [
                                                    { $eq: ["$item_for_basics._id", '$sellinpoint_for_basics._id'] },
                                                    { $eq: [basics_value, 'on'] },
                                                    {
                                                        $or: [
                                                            { $eq: ['$item_for_basics.onoff', 'on'] }, { $eq: ['$item_for_basics.onoff', 'hide'] },
                                                        ]
                                                    },
                                                    {
                                                        $or: [
                                                            { $eq: ['$item_for_basics.name', 'Pauschale pro Lieferung'] }, { $eq: ['$item_for_basics.name', 'Gefahrgutpauschale (GGVS)'] }, { $eq: ['$item_for_basics.name', 'Einblaspauschale'] }
                                                        ]
                                                    },
                                                    { $eq: [basics_value_product, 'yes'] },]
                                            }, then: "$item_for_basics", else: basicsnone
                                        }
                                    },
                                'items': 1,
                                'sellingpoints': 1,
                                'sellingp_points': 1,
                                'deliveryzone_for_id': 1,
                                'items2': 1,
                                'items3': 1,
                                'qualities': 1,
                                'matched_data_length': 1,
                                'sammel': 1
                            }
                        },
                        {
                            $group: {
                                "_id": '$_id',
                                'qualities': { '$first': '$qualities' },
                                'sellingpoints': { '$first': '$sellingpoints' },
                                'sellingp_points': { '$first': '$sellingp_points' },
                                'deliveryzone_for_id': { '$first': '$deliveryzone_for_id' },
                                'items2': { '$first': '$items2' },
                                'items3': { '$first': '$items3' },
                                'items': { '$first': '$items' },
                                'matched_data_length': { '$first': '$matched_data_length' },
                                'basics': { '$addToSet': '$basics' },
                                'sammel': { '$first': '$sammel' }
                            }
                        },



                        { $unwind: '$items2' },
                        { $match: { 'items2._id': { $in: [ObjectId(req.body.Liefertermin._id)] } } },
                        {
                            $match: {
                                $or: [
                                    { 'items2.MaxKm': { $gte: parseFloat(spc.traveldistance) } },
                                    { 'items2.MaxKm_show': 'no' },
                                    { 'items2.MaxKm': { $eq: 0 } },
                                ]

                            }
                        },
                        {
                            $project: {
                                'sellingpoints': 1,
                                'sellingp_points': 1,
                                'deliveryzone_for_id': 1,
                                'items3': 1,
                                'qualities': 1,
                                'basics': 1,
                                'items': 1, 'matched_data_length': 1,
                                'sammel': 1
                            }
                        },
                        { $unwind: '$items3' },
                        { $match: { 'items3._id': { $in: [ObjectId(req.body.Schlauchlange._id)] } } },
                        {
                            $match: {
                                $or: [
                                    { 'items3.MaxKm': { $gte: parseFloat(spc.traveldistance) } },
                                    { 'items3.calculation': "standard" },
                                    { 'items3.MaxKm': { $eq: 0 } },
                                ]

                            }
                        },
                        { "$unwind": '$items' },
                        { "$unwind": "$sellingp_points" },
                        { $match: { $or: [{ "items._id": { $in: inputarray } }, { 'items.color': { $exists: true } }] } },
                        { $match: { "sellingp_points._id": { $in: inputarray } } },
                        {
                            $project: {
                                euro100l: { $cond: { if: { $and: [{ $eq: ["$items.convert", 'Euro/100l/Tonne'] }] }, then: "$items", else: 0 } },
                                'sellingpoints': 1, 'matched_data_length': 1, 'sellingp_points': 1, 'deliveryzone_for_id': 1, 'items': 1, 'qualities': 1, 'basics': 1,
                                'sammel': 1
                            }
                        },
                        {
                            $project: {
                                eurobestellung: { $cond: { if: { $and: [{ $eq: ["$items.convert", 'Euro/Bestellung'] }] }, then: "$items", else: 0 } },
                                'sellingpoints': 1, 'matched_data_length': 1, 'sellingp_points': 1, 'deliveryzone_for_id': 1, 'euro100l': 1, 'items': 1, 'qualities': 1, 'basics': 1,
                                'sammel': 1
                            }
                        },
                        {
                            $project: {
                                eurokm: { $cond: { if: { $and: [{ $eq: ["$items.convert", 'Euro/Km'] }] }, then: "$items", else: 0 } },
                                'sellingpoints': 1, 'matched_data_length': 1, 'sellingp_points': 1, 'deliveryzone_for_id': 1, 'eurobestellung': 1, 'euro100l': 1, 'qualities': 1, 'basics': 1,
                                'sammel': 1
                            }
                        },
                        {
                            $project: {
                                "eurobestellung._id": "$eurobestellung._id",
                                'eurobestellung.heatoilvalue': '$sellingp_points.heatoilvalue',
                                'eurobestellung.dieselvalue': '$sellingp_points.dieselvalue',
                                'eurobestellung.benzinvalue': '$sellingp_points.benzinvalue',
                                'eurobestellung.pelletsvalue': '$sellingp_points.pelletsvalue',
                                "eurobestellung.onoff": "$eurobestellung.onoff",
                                "eurobestellung.name": "$eurobestellung.name",
                                "eurobestellung.convert": "$eurobestellung.convert",
                                "eurobestellung.heatoil_value_show": "$eurobestellung.heatoil_value_show",
                                "eurobestellung.diesel_value_show": "$eurobestellung.diesel_value_show",
                                "eurobestellung.benzin_value_show": "$eurobestellung.benzin_value_show",
                                "eurobestellung.pellets_value_show": "$eurobestellung.pellets_value_show",
                                "eurobestellung.heatoil_value": "$eurobestellung.heatoil_value",
                                "eurobestellung.diesel_value": "$eurobestellung.diesel_value",
                                "eurobestellung.benzin_value": "$eurobestellung.benzin_value",
                                "eurobestellung.pellets_value": "$eurobestellung.pellets_value",

                                "eurokm._id": "$eurokm._id",
                                'eurokm.heatoilvalue': '$sellingp_points.heatoilvalue',
                                'eurokm.dieselvalue': '$sellingp_points.dieselvalue',
                                'eurokm.benzinvalue': '$sellingp_points.benzinvalue',
                                'eurokm.pelletsvalue': '$sellingp_points.pelletsvalue',
                                "eurokm.onoff": "$eurokm.onoff",
                                "eurokm.name": "$eurokm.name",
                                "eurokm.convert": "$eurokm.convert",
                                "eurokm.heatoil_value_show": "$eurokm.heatoil_value_show",
                                "eurokm.diesel_value_show": "$eurokm.diesel_value_show",
                                "eurokm.benzin_value_show": "$eurokm.benzin_value_show",
                                "eurokm.pellets_value_show": "$eurokm.pellets_value_show",
                                "eurokm.heatoil_value": "$eurokm.heatoil_value",
                                "eurokm.diesel_value": "$eurokm.diesel_value",
                                "eurokm.benzin_value": "$eurokm.benzin_value",
                                "eurokm.pellets_value": "$eurokm.pellets_value",


                                "euro100l._id": "$euro100l._id",
                                'euro100l.heatoilvalue': '$sellingp_points.heatoilvalue',
                                'euro100l.dieselvalue': '$sellingp_points.dieselvalue',
                                'euro100l.benzinvalue': '$sellingp_points.benzinvalue',
                                'euro100l.pelletsvalue': '$sellingp_points.pelletsvalue',
                                "euro100l.onoff": "$euro100l.onoff",
                                "euro100l.name": "$euro100l.name",
                                "euro100l.convert": "$euro100l.convert",
                                "euro100l.heatoil_value_show": "$euro100l.heatoil_value_show",
                                "euro100l.diesel_value_show": "$euro100l.diesel_value_show",
                                "euro100l.benzin_value_show": "$euro100l.benzin_value_show",
                                "euro100l.pellets_value_show": "$euro100l.pellets_value_show",
                                "euro100l.heatoil_value": "$euro100l.heatoil_value",
                                "euro100l.diesel_value": "$euro100l.diesel_value",
                                "euro100l.benzin_value": "$euro100l.benzin_value",
                                "euro100l.pellets_value": "$euro100l.pellets_value",


                                'sellingpoints': 1,
                                'sellingp_points': 1,
                                'qualities': 1, 'basics': 1, 'matched_data_length': 1,
                                'sammel': 1,


                                "deliveryzone_for_id._id": "$deliveryzone_for_id._id",
                                'deliveryzone_for_id.heatoilvalue': 'on',
                                'deliveryzone_for_id.dieselvalue': 'on',
                                'deliveryzone_for_id.benzinvalue': 'on',
                                'deliveryzone_for_id.pelletsvalue': 'on',
                                "deliveryzone_for_id.onoff": "on",
                                "deliveryzone_for_id.name": "Lieferzonen",
                                "deliveryzone_for_id.convert": "$deliveryzone_for_id.convert",
                                "deliveryzone_for_id.heatoil_value_show": "yes",
                                "deliveryzone_for_id.diesel_value_show": "yes",
                                "deliveryzone_for_id.benzin_value_show": "yes",
                                "deliveryzone_for_id.pellets_value_show": "yes",
                                "deliveryzone_for_id.heatoil_value": "$deliveryzone_for_id.heatoil_value",
                                "deliveryzone_for_id.diesel_value": "$deliveryzone_for_id.diesel_value",
                                "deliveryzone_for_id.benzin_value": "$deliveryzone_for_id.benzin_value",
                                "deliveryzone_for_id.pellets_value": "$deliveryzone_for_id.pellets_value",
                            }
                        },
                        { $project: { eurobestellung: { $cond: { if: { $or: [{ $eq: ["$eurobestellung._id", '$sellingp_points._id'] }, { $eq: ["$eurobestellung._id", '$deliveryzone_for_id._id'] }] }, then: "$eurobestellung", else: 0 } }, 'sammel': 1, 'sellingpoints': 1, 'matched_data_length': 1, 'sellingp_points': 1, 'euro100l': 1, 'eurokm': 1, 'deliveryzone_for_id': 1, 'qualities': 1, 'basics': 1 } },
                        { $project: { euro100l: { $cond: { if: { $or: [{ $eq: ["$euro100l._id", '$sellingp_points._id'] }, { $eq: ["$euro100l._id", '$deliveryzone_for_id._id'] }] }, then: "$euro100l", else: 0 } }, 'sammel': 1, 'sellingp_points': 1, 'sellingpoints': 1, 'matched_data_length': 1, 'eurobestellung': 1, 'deliveryzone_for_id': 1, 'eurokm': 1, 'qualities': 1, 'basics': 1 } },
                        { $project: { eurokm: { $cond: { if: { $or: [{ $eq: ["$eurokm._id", '$sellingp_points._id'] }, { $eq: ["$eurokm._id", '$deliveryzone_for_id._id'] }] }, then: "$eurokm", else: 0 } }, 'sammel': 1, 'sellingpoints': 1, 'eurobestellung': 1, 'matched_data_length': 1, 'deliveryzone_for_id': 1, 'euro100l': 1, 'qualities': 1, 'basics': 1 } },

                        { $project: { eurobestellung: { $cond: { if: { $and: [{ $eq: [query10, 'on'] }] }, then: "$eurobestellung", else: 0 } }, 'sammel': 1, 'sellingpoints': 1, 'sellingp_points': 1, 'euro100l': 1, 'deliveryzone_for_id': 1, 'eurokm': 1, 'matched_data_length': 1, 'qualities': 1, 'basics': 1 } },
                        { $project: { euro100l: { $cond: { if: { $and: [{ $eq: [query9, 'on'] }] }, then: "$euro100l", else: 0 } }, 'sammel': 1, 'sellingpoints': 1, 'sellingp_points': 1, 'eurobestellung': 1, 'deliveryzone_for_id': 1, 'eurokm': 1, 'matched_data_length': 1, 'qualities': 1, 'basics': 1 } },
                        { $project: { eurokm: { $cond: { if: { $and: [{ $eq: [query_new_2, 'on'] }] }, then: "$eurokm", else: 0 } }, 'sammel': 1, 'sellingpoints': 1, 'eurobestellung': 1, 'deliveryzone_for_id': 1, 'euro100l': 1, 'matched_data_length': 1, 'qualities': 1, 'basics': 1 } },


                        {
                            $match: {
                                $or: [
                                    { 'euro100l': { $ne: 0 } },
                                    { 'eurobestellung': { $ne: 0 } },
                                    { 'eurokm': { $ne: 0 } }

                                ]


                            }
                        },
                        { $project: { eurobestellung: { $cond: { if: { $eq: ["$eurobestellung._id", '$deliveryzone_for_id._id'] }, then: "$deliveryzone_for_id", else: '$eurobestellung' } }, 'sammel': 1, 'sellingpoints': 1, 'euro100l': 1, 'deliveryzone_for_id': 1, 'matched_data_length': 1, 'eurokm': 1, 'qualities': 1, 'basics': 1 } },
                        { $project: { euro100l: { $cond: { if: { $eq: ["$euro100l._id", '$deliveryzone_for_id._id'] }, then: "$deliveryzone_for_id", else: '$euro100l' } }, 'sammel': 1, 'sellingpoints': 1, 'deliveryzone_for_id': 1, 'eurobestellung': 1, 'eurokm': 1, 'matched_data_length': 1, 'qualities': 1, 'basics': 1 } },
                        { $project: { eurokm: { $cond: { if: { $eq: ["$eurokm._id", '$deliveryzone_for_id._id'] }, then: "$deliveryzone_for_id", else: '$eurokm' } }, 'sammel': 1, 'sellingpoints': 1, 'eurobestellung': 1, 'euro100l': 1, 'qualities': 1, 'basics': 1, 'matched_data_length': 1 } },

                        {
                            $group: {
                                "_id": '$_id', 'matched_data_length': { '$first': '$matched_data_length' }, 'sellingpoints': { '$first': '$sellingpoints' }, 'euro100l': { '$addToSet': '$euro100l' }, 'eurobestellung': { '$addToSet': '$eurobestellung' }, 'eurokm': { '$addToSet': '$eurokm' }, 'qualities': { '$first': '$qualities' }, 'basics': { '$first': '$basics' },
                                'sammel': { '$first': '$sammel' }
                            }
                        },

                        {
                            $project: {
                                'sellingpoints.selling_p_settings': 0
                            }
                        },
                        { "$unwind": "$euro100l" },
                        { $project: { euro100l: { $cond: { if: { $eq: ["$euro100l", 0] }, then: "$deliveryzone_for_id", else: '$euro100l' } }, 'sammel': 1, 'matched_data_length': 1, 'sellingpoints': 1, 'eurobestellung': 1, 'eurokm': 1, 'qualities': 1, 'basics': 1 } },
                        {
                            $group: {
                                "_id": '$_id', 'matched_data_length': { '$first': '$matched_data_length' }, 'euro100l_sum': { $sum: query4 }, 'eurokm': { '$first': '$eurokm' }, 'eurobestellung': { '$first': '$eurobestellung' }, 'sellingpoints': { '$first': '$sellingpoints' }, 'qualities': { '$first': '$qualities' }, 'basics': { '$first': '$basics' },
                                'sammel': { '$first': '$sammel' }
                            }
                        },

                        { "$unwind": "$eurobestellung" },
                        { $project: { eurobestellung: { $cond: { if: { $eq: ["$eurobestellung", 0] }, then: "$deliveryzone_for_id", else: '$eurobestellung' } }, 'sammel': 1, 'matched_data_length': 1, 'sellingpoints': 1, 'euro100l_sum': 1, 'eurokm': 1, 'qualities': 1, 'basics': 1 } },
                        {
                            $group: {
                                "_id": '$_id', 'matched_data_length': { '$first': '$matched_data_length' }, 'eurobestellung_sum': { $sum: query5 }, 'euro100l_sum': { '$first': '$euro100l_sum' }, 'eurokm': { '$first': '$eurokm' }, 'sellingpoints': { '$first': '$sellingpoints' }, 'qualities': { '$first': '$qualities' }, 'basics': { '$first': '$basics' },
                                'sammel': { '$first': '$sammel' }
                            }
                        },

                        { "$unwind": "$eurokm" },
                        { $project: { eurokm: { $cond: { if: { $eq: ["$eurokm", 0] }, then: "$deliveryzone_for_id", else: '$eurokm' } }, 'sammel': 1, 'matched_data_length': 1, 'sellingpoints': 1, 'euro100l_sum': 1, 'eurobestellung_sum': 1, 'qualities': 1, 'basics': 1 } },
                        {
                            $group: {
                                "_id": '$_id', 'matched_data_length': { '$first': '$matched_data_length' }, 'eurokm_sum': { $sum: query_new_1 }, 'euro100l_sum': { '$first': '$euro100l_sum' }, 'eurobestellung_sum': { '$first': '$eurobestellung_sum' }, 'sellingpoints': { '$first': '$sellingpoints' }, 'qualities': { '$first': '$qualities' }, 'basics': { '$first': '$basics' },
                                'sammel': { '$first': '$sammel' }
                            }
                        },



                        { "$unwind": "$qualities" },
                        { $project: { qualities: { $cond: { if: { $eq: ["$qualities", 0] }, then: "$deliveryzone_for_id", else: '$qualities' } }, 'sammel': 1, 'matched_data_length': 1, 'sellingpoints': 1, 'euro100l_sum': 1, 'eurokm_sum': 1, 'eurobestellung_sum': 1, 'basics': 1 } },
                        {
                            $group: {
                                "_id": '$_id', 'matched_data_length': { '$first': '$matched_data_length' }, 'qualities': { '$addToSet': '$qualities' }, 'euro100l_sum': { '$first': '$euro100l_sum' }, 'eurobestellung_sum': { '$first': '$eurobestellung_sum' }, 'sellingpoints': { '$first': '$sellingpoints' }, 'eurokm_sum': { '$first': '$eurokm_sum' }, 'basics': { '$first': '$basics' },
                                'sammel': { '$first': '$sammel' }
                            }
                        },


                        { $unwind: '$qualities' },
                        { $sort: { 'qualities._id': 1 } },
                        {
                            $group: {
                                "_id": '$_id', 'matched_data_length': { '$first': '$matched_data_length' }, 'qualities': { $push: '$qualities' }, 'euro100l_sum': { '$first': '$euro100l_sum' }, 'eurobestellung_sum': { '$first': '$eurobestellung_sum' }, 'sellingpoints': { '$first': '$sellingpoints' }, 'eurokm_sum': { '$first': '$eurokm_sum' }, 'basics': { '$first': '$basics' },
                                'sammel': { '$first': '$sammel' }
                            }
                        },


                        { "$unwind": "$basics" },
                        {
                            $group: {
                                "_id": '$_id', 'matched_data_length': { '$first': '$matched_data_length' }, 'qualities': { '$first': '$qualities' }, 'basics_sum': { $sum: basics_sum }, 'euro100l_sum': { '$first': '$euro100l_sum' }, 'eurobestellung_sum': { '$first': '$eurobestellung_sum' }, 'sellingpoints': { '$first': '$sellingpoints' }, 'eurokm_sum': { '$first': '$eurokm_sum' },
                                'sammel': { '$first': '$sammel' }
                            }
                        },
                        { $project: { 'matched_data_length': 1, 'qualities': 1, 'eurobestellung_sum': { $add: ["$basics_sum", "$eurobestellung_sum"] }, 'euro100l_sum': 1, 'sellingpoints': 1, 'eurokm_sum': 1, 'sammel': 1 } },

                        { "$unwind": "$sammel" },
                        {
                            $group: {
                                "_id": '$_id', 'matched_data_length': { '$first': '$matched_data_length' }, 'qualities': { '$first': '$qualities' }, 'euro100l_sum': { '$first': '$euro100l_sum' }, 'eurobestellung_sum': { '$first': '$eurobestellung_sum' }, 'sellingpoints': { '$first': '$sellingpoints' }, 'eurokm_sum': { '$first': '$eurokm_sum' },
                                'sammel': { $sum: sammalsum }
                            }
                        },
                        { $project: { 'matched_data_length': 1, 'qualities': 1, 'eurobestellung_sum': 1, 'euro100l_sum': 1, 'sellingpoints': 1, 'eurokm_sum': 1, 'sammel': 1 } },




                    ], async function (err, data123) {
                        if (err) {
                            console.log(err, 'ss');

                        } else {
                            if (req.body.Produkt.name == 'Pellets') {
                                manual_ocm(data123[0], 'manual_pellets_id', res.userdata.MyMasterId, function (data_manual) {
                                    if (data_manual.manual_price_callback_false || data123[0].matched_data_length != inputarray.length) {
                                        var myobject = {
                                            error: true,
                                            falsedata: [
                                            ],
                                            maindata: []
                                        }
                                        final_pc.push(myobject);
                                    } else {

                                        var object = pelletssupportedfile(data123[0], spc, req.body, parseFloat(data_manual[0].value), query7, query8, query_quality);

                                        var myobject = {
                                            error: false,
                                            falsedata: [
                                            ],
                                            maindata: object
                                        }
                                        final_pc.push(myobject);

                                    }

                                    if (dataaa[0].plz.length - 1 == index) {

                                        final_pc = final_pc.filter(function (obj) {
                                            return obj.error !== true;
                                        });

                                        if (final_pc.length > 0) {


                                            var new_array = [];
                                            for (var i in final_pc) {
                                                new_array.push(final_pc[i].maindata);

                                            }


                                            function flatten(arr) {
                                                return arr.reduce(function (flat, toFlatten) {
                                                    return flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten);
                                                }, []);
                                            }
                                            new_array = flatten(new_array);
                                            var car_array = new_array.reduce((prev, t, index, arr) => {
                                                if (typeof prev[t._id] === 'undefined') {
                                                    prev[t._id] = [];
                                                }
                                                prev[t._id].push(t);
                                                return prev;
                                            }, {});

                                            function hasMin(attrib) {
                                                return this.reduce(function (prev, curr) {
                                                    return prev[attrib] < curr[attrib] ? prev : curr;
                                                });
                                            }

                                            var anotherarray = [];
                                            for (var key in car_array) {
                                                var array_of_cars_with_same_id = car_array[key];
                                                //use this array to do some stuff
                                                var data12345 = array_of_cars_with_same_id.reduce(function (prev, curr) {
                                                    return prev.compareprice < curr.compareprice ? prev : curr;
                                                });
                                                anotherarray.push(data12345);
                                            }

                                            var latest = {
                                                error: false,
                                                falsedata: [
                                                ],
                                                maindata: anotherarray
                                            };



                                        } else {
                                            var latest = {
                                                error: true,
                                                falsedata: [
                                                    { name: 'Liefertermin', msg: 'max km exceeded' },
                                                    { name: 'Schlauchlänge', msg: 'max km exceeded' }
                                                ],
                                                maindata: []
                                            };
                                        }

                                        if (err) {
                                            //return (JSON.stringify({ 'success': false, msg: 'mongoerror', errkind: 'mongoerror' }));
                                            let object = { 'success': false, msg: 'mongoerror', errkind: 'mongoerror' }
                                            callback(object);
                                            db.close();
                                        }
                                        else {
                                            let object = { success: true, data: latest };
                                            callback(object);

                                            db.close();
                                        }
                                    }


                                });


                            }
                            else {

                                if (data123[0] == 'null' || data123[0] == undefined || data123[0].matched_data_length != inputarray.length) {
                                    var myobject = {
                                        error: true,
                                        falsedata: [
                                        ],
                                        maindata: []
                                    }
                                    final_pc.push(myobject);

                                    if (dataaa[0].plz.length - 1 == index) {

                                        final_pc = final_pc.filter(function (obj) {
                                            return obj.error !== true;
                                        });

                                        if (final_pc.length > 0) {


                                            var new_array = [];
                                            for (var i in final_pc) {
                                                new_array.push(final_pc[i].maindata);

                                            }


                                            function flatten(arr) {
                                                return arr.reduce(function (flat, toFlatten) {
                                                    return flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten);
                                                }, []);
                                            }
                                            new_array = flatten(new_array);
                                            var car_array = new_array.reduce((prev, t, index, arr) => {
                                                if (typeof prev[t._id] === 'undefined') {
                                                    prev[t._id] = [];
                                                }
                                                prev[t._id].push(t);
                                                return prev;
                                            }, {});

                                            function hasMin(attrib) {
                                                return this.reduce(function (prev, curr) {
                                                    return prev[attrib] < curr[attrib] ? prev : curr;
                                                });
                                            }

                                            var anotherarray = [];
                                            for (var key in car_array) {
                                                var array_of_cars_with_same_id = car_array[key];
                                                //use this array to do some stuff
                                                var data12345 = array_of_cars_with_same_id.reduce(function (prev, curr) {
                                                    return prev.compareprice < curr.compareprice ? prev : curr;
                                                });
                                                anotherarray.push(data12345);
                                            }

                                            var latest = {
                                                error: false,
                                                falsedata: [
                                                ],
                                                maindata: anotherarray
                                            };



                                        } else {
                                            var latest = {
                                                error: true,
                                                falsedata: [
                                                    { name: 'Liefertermin', msg: 'max km exceeded' },
                                                    { name: 'Schlauchlänge', msg: 'max km exceeded' }
                                                ],
                                                maindata: []
                                            };
                                        }


                                        if (err) {
                                            //return (JSON.stringify({ 'success': false, msg: 'mongoerror', errkind: 'mongoerror' }));
                                            let object = { 'success': false, msg: 'mongoerror', errkind: 'mongoerror' }
                                            callback(object);
                                            db.close();
                                        }
                                        else {
                                            let object = { success: true, data: latest };
                                            callback(object);

                                            db.close();
                                        }
                                    }
                                }
                                else if (data123[0]['sellingpoints']['rpi_button']) {
                                    var finalocm = data123[0].sellingpoints.ocm_select + query6;
                                    var manual_or_ocm;
                                    manual_or_ocm = parseFloat(ocm_data[0][finalocm]);


                                    var object = otherproducts(data123[0], spc, req.body, manual_or_ocm, query7, query8, query_quality);
                                    var myobject = {
                                        error: false,
                                        falsedata: [
                                        ],
                                        maindata: object
                                    }
                                    final_pc.push(myobject);


                                    if (dataaa[0].plz.length - 1 == index) {

                                        final_pc = final_pc.filter(function (obj) {
                                            return obj.error !== true;
                                        });

                                        if (final_pc.length > 0) {


                                            var new_array = [];
                                            for (var i in final_pc) {
                                                new_array.push(final_pc[i].maindata);

                                            }


                                            function flatten(arr) {
                                                return arr.reduce(function (flat, toFlatten) {
                                                    return flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten);
                                                }, []);
                                            }
                                            new_array = flatten(new_array);
                                            var car_array = new_array.reduce((prev, t, index, arr) => {
                                                if (typeof prev[t._id] === 'undefined') {
                                                    prev[t._id] = [];
                                                }
                                                prev[t._id].push(t);
                                                return prev;
                                            }, {});

                                            function hasMin(attrib) {
                                                return this.reduce(function (prev, curr) {
                                                    return prev[attrib] < curr[attrib] ? prev : curr;
                                                });
                                            }

                                            var anotherarray = [];
                                            for (var key in car_array) {
                                                var array_of_cars_with_same_id = car_array[key];
                                                //use this array to do some stuff
                                                var data12345 = array_of_cars_with_same_id.reduce(function (prev, curr) {
                                                    return prev.compareprice < curr.compareprice ? prev : curr;
                                                });
                                                anotherarray.push(data12345);
                                            }

                                            var latest = {
                                                error: false,
                                                falsedata: [
                                                ],
                                                maindata: anotherarray
                                            };



                                        } else {
                                            var latest = {
                                                error: true,
                                                falsedata: [
                                                    { name: 'Liefertermin', msg: 'max km exceeded' },
                                                    { name: 'Schlauchlänge', msg: 'max km exceeded' }
                                                ],
                                                maindata: []
                                            };
                                        }


                                        if (err) {
                                            //return (JSON.stringify({ 'success': false, msg: 'mongoerror', errkind: 'mongoerror' }));
                                            let object = { 'success': false, msg: 'mongoerror', errkind: 'mongoerror' }
                                            callback(object);
                                            db.close();
                                        }
                                        else {
                                            let object = { success: true, data: latest };
                                            callback(object);

                                            db.close();
                                        }
                                    }

                                }
                                else if (!data123[0]['sellingpoints']['rpi_button']) {

                                    manual_ocm(data123[0], 'manual_heatoil_id', res.userdata.MyMasterId, function (data_manual) {

                                        if (data_manual.manual_price_callback_false || data123[0].matched_data_length != inputarray.length) {
                                            var myobject = {
                                                error: true,
                                                falsedata: [
                                                ],
                                                maindata: []
                                            }
                                            final_pc.push(myobject);
                                        } else {

                                            var object = otherproducts(data123[0], spc, req.body, parseFloat(data_manual[0].value), query7, query8, query_quality);
                                            var myobject = {
                                                error: false,
                                                falsedata: [
                                                ],
                                                maindata: object
                                            }
                                            final_pc.push(myobject);

                                        }
                                        if (dataaa[0].plz.length - 1 == index) {

                                            final_pc = final_pc.filter(function (obj) {
                                                return obj.error !== true;
                                            });

                                            if (final_pc.length > 0) {


                                                var new_array = [];
                                                for (var i in final_pc) {
                                                    new_array.push(final_pc[i].maindata);

                                                }


                                                function flatten(arr) {
                                                    return arr.reduce(function (flat, toFlatten) {
                                                        return flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten);
                                                    }, []);
                                                }
                                                new_array = flatten(new_array);
                                                var car_array = new_array.reduce((prev, t, index, arr) => {
                                                    if (typeof prev[t._id] === 'undefined') {
                                                        prev[t._id] = [];
                                                    }
                                                    prev[t._id].push(t);
                                                    return prev;
                                                }, {});

                                                function hasMin(attrib) {
                                                    return this.reduce(function (prev, curr) {
                                                        return prev[attrib] < curr[attrib] ? prev : curr;
                                                    });
                                                }

                                                var anotherarray = [];
                                                for (var key in car_array) {
                                                    var array_of_cars_with_same_id = car_array[key];
                                                    //use this array to do some stuff
                                                    var data12345 = array_of_cars_with_same_id.reduce(function (prev, curr) {
                                                        return prev.compareprice < curr.compareprice ? prev : curr;
                                                    });
                                                    anotherarray.push(data12345);
                                                }

                                                var latest = {
                                                    error: false,
                                                    falsedata: [
                                                    ],
                                                    maindata: anotherarray
                                                };



                                            } else {
                                                var latest = {
                                                    error: true,
                                                    falsedata: [
                                                        { name: 'Liefertermin', msg: 'max km exceeded' },
                                                        { name: 'Schlauchlänge', msg: 'max km exceeded' }
                                                    ],
                                                    maindata: []
                                                };
                                            }


                                            if (err) {
                                                //return (JSON.stringify({ 'success': false, msg: 'mongoerror', errkind: 'mongoerror' }));
                                                let object = { 'success': false, msg: 'mongoerror', errkind: 'mongoerror' }
                                                callback(object);
                                                db.close();
                                            }
                                            else {
                                                let object = { success: true, data: latest };
                                                callback(object);

                                                db.close();
                                            }
                                        }


                                    });

                                }


                            }
                        }




                    });
                }


            });
        });
    });
}


apiBigpc.post('/ZahlungMail', function (req, res) {
    var data = {};
    data.body = req.body.bestellung;
    calculation(data, res, function (data) {
        if (data.success && !data.data.error) {
            var matcheddata = (data.data.maindata).find(x => x._id == req.body.bookedOrder._id);
            if (parseFloat(matcheddata.compareprice) == parseFloat(req.body.bookedOrder.compareprice)) {
                mongoClient.connect(url, function (err, db) {
                    var newdate = new Date();
                    db.collection('aupris_finalorder_data').insert(booking_insert(res.userdata, req.body, matcheddata, newdate), function (err, data) {
                        if (err) {
                            res.write(JSON.stringify({ success: false, msg: 'no options found!', errkind: 'mongoerror' }));
                            res.end();
                            db.close();

                        } else {
                            db.collection('aupris_common_data').findOne({ 'MyMasterId': ObjectId(res.userdata.MyMasterId) }, function (err, commondata) {
                                transporter.sendMail(zahlung_mail_trader(res.userdata, req.body, matcheddata, commondata, newdate), function (error, info) {
                                    transporter.sendMail(booking_mail_customer(res.userdata, req.body, matcheddata, commondata, newdate), function (error_cus, info_cus) {
                                        if (error || error_cus) {
                                            res.write(JSON.stringify({ success: false, msg: 'mail error', errkind: 'mail error' }));
                                            res.end();
                                            db.close();
                                        }
                                        else {
                                            res.write(JSON.stringify({ sucess: true, msg: 'Email sent' }));
                                            db.close();
                                            res.end();
                                        }
                                    });
                                });
                            });

                        }

                    });

                });
            }
            else {
                res.write(JSON.stringify({ sucess: false, error: 'prices changed' }));
                res.end();

            }
        }
        else {
            res.write(JSON.stringify({ sucess: false, error: 'mongoerror' }));
            res.end();

        }
    });


});

function base64toBlob(base64Data, contentType) {
    contentType = contentType || '';
    var sliceSize = 1024;
    var byteCharacters = atob(base64Data);
    var bytesLength = byteCharacters.length;
    var slicesCount = Math.ceil(bytesLength / sliceSize);
    var byteArrays = new Array(slicesCount);

    for (var sliceIndex = 0; sliceIndex < slicesCount; ++sliceIndex) {
        var begin = sliceIndex * sliceSize;
        var end = Math.min(begin + sliceSize, bytesLength);

        var bytes = new Array(end - begin);
        for (var offset = begin, i = 0; offset < end; ++i, ++offset) {
            bytes[i] = byteCharacters[offset].charCodeAt(0);
        }
        byteArrays[sliceIndex] = new Uint8Array(bytes);
    }
    return byteArrays;
}


apiBigpc.post('/pdfdownload', function (req, res) {
    if (req.body.type == 'AGB') {
        if (res.userdata.email_setup.pdf.data) {
            res.userdata.email_setup.pdf.data = (res.userdata.email_setup.pdf.data).toString('base64');
            res.write(JSON.stringify({ sucess: true, data: res.userdata.email_setup.pdf }));
            res.end();
        }
        else {
            res.write(JSON.stringify({ sucess: false, data: 'no pdf' }));
            res.end();

        }

    }
    else if (req.body.type == 'Widerrufsbelehrung') {

        if (res.userdata.email_setup.pdf1.data) {
            res.userdata.email_setup.pdf1.data = (res.userdata.email_setup.pdf1.data).toString('base64');
            res.write(JSON.stringify({ sucess: true, data: res.userdata.email_setup.pdf1 }));
            res.end();
        }
        else {
            res.write(JSON.stringify({ sucess: false, data: 'no pdf' }));
            res.end();

        }

    }
    else {

        if (res.userdata.email_setup.pdf2.data) {
            res.userdata.email_setup.pdf2.data = (res.userdata.email_setup.pdf2.data).toString('base64');
            res.write(JSON.stringify({ sucess: true, data: res.userdata.email_setup.pdf2 }));
            res.end();
        }
        else {
            res.write(JSON.stringify({ sucess: false, data: 'no pdf' }));
            res.end();

        }

    }

});



https.createServer(options, app).listen(3800);