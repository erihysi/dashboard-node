var express = require('express');
var bodyParser = require('body-parser');
var axios = require('axios');

var app = express();
var router = express.Router();
var path = __dirname + '/views/';

var acquisition_api_key = "31I4HHdML8AH30OQCqbuRswzFcvhigvs3f15UQqc6VuOnTNzKYJosB43I5vE2o2SmwNYhh7oCS5X1XUJjhDzlnX9RugHJ";
var monetization_api_key = "mwNNiwFuJ30GqpuYwQHSW0XQx93E2rIS7NRSfxwLz4XI5Yoo5aSP8wvyibhVO8aYeaVLYsCJcFP9V0uzo95ph66qktQwE";


router.use(function (req,res,next) {
  console.log("/" + req.method);
  next();
});

router.use(bodyParser.json());

router.get("/",function(req,res){
  res.sendFile(path + "index.html");
});

router.post("/dashboard",function(req,res,next){
    console.log(req.body);

    axios.all([
        axios.get('http://mock-api.voodoo.io/acquisition?api_key='+acquisition_api_key+'&start='+req.body.from_date+'&end='+req.body.to_date+'&format=json&columns=day,country,cost,application,platform,package_name,ad_type,impressions,clicks,ctr'),
        axios.get('http://mock-api.voodoo.io/monetization?start='+req.body.from_date+'&end='+req.body.to_date+'&dimensions=date,country,os,game&aggregates=revenue',{
            headers: {'Authorization': 'Bearer '+ monetization_api_key }
        })
    ]).then(axios.spread((response1, response2) => {
            console.log("Successfull retrieval of analytics");
            res.json(processAnalytics(response1.data.data,response2.data.data));
    })).catch(error => {
        console.log(error);
        setImmediate(() => { next(new Error("Failed to retrieve API data :" + error)) });
    });
});

app.use("/",router);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use("*",function(req,res){
   console.log("Request in error" + req);
   res.sendFile(path + "error.html");
});

app.use(function(error, req, res, next) {
  res.status(500).json({ message: error.message });
});


app.listen(3000,function(){
  console.log("Live at Port 3000");
});



function processAnalytics(response1,response2){
    var analytics = new Object();

    var map = new Map();
    var apps = new Set();
    var countries = new Set();
    var os = new Set();

    for(let acquisition of response1){
        apps.add(acquisition.application);
        countries.add(acquisition.country);
        os.add(acquisition.platform);
        var key = acquisition.application + '-' + acquisition.country + '-' + acquisition.platform;
        var value = map.get(key);
        if(!value){
            value = {
                application : acquisition.application,
                country : acquisition.country,
                os : acquisition.platform,
                expenditure : 0,
                revenue : 0
                };
        }
        value.expenditure -= acquisition.cost;
        map.set(key, value);
    }

    for(let monetization of response2){
        apps.add(monetization.game);
        countries.add(monetization.country);
        os.add(monetization.os);
        var key = monetization.game + '-' + monetization.country + '-' + monetization.os;
        var value = map.get(key);
        if(!value){
            value = {
                application : monetization.game,
                country : monetization.country,
                os : monetization.os,
                expenditure : 0,
                revenue : 0
                };
        }
        value.revenue += monetization.revenue;
        map.set(key, value);
    }

    analytics.apps = Array.from(apps);
    analytics.os = Array.from(os);
    analytics.countries = Array.from(countries);
    analytics.data = Array.from(map.values());
    return analytics;
}