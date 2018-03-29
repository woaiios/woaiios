$(document).ready(function() {
	getLocation();
  $("#tpCute").click(function() {
    var tt = $("#temp-type").text();
    var temp = $("#temp").text();
    if (tt == "°F") {
      $("#temp").text(CC);
      $("#temp-type").text("°C");
    } else {
      $("#temp").text(FF);
      $("#temp-type").text("°F");
    }
  });
});

var CC;
var FF;

function weather(lat,lng) {
  	var weatherURL = "https://fcc-weather-api.glitch.me/api/current?lat=" + lat + "&lon=" + lng;
  	weatherURL = encodeURI(weatherURL);
  	httpGetAsync(weatherURL, function(obj) {
  	  	var city = obj.name;
  	    var tempture = Math.floor(Number(obj.main.temp) + 0.5);   
  	    CC = tempture;
        FF = parseInt(tempture * 1.8 + 32);
        var icon = obj.weather[0].icon;
        var mainD = obj.weather[0].main;
        var detaiLDec = obj.weather[0].description;

  	    $("#icon").attr("src", icon);
  	    $("#city").text(city);
  	    $("#temp").text(String(tempture));
  	  	$("#mainDec").text(mainD);
  	  	$("#detailDec").text(detaiLDec);
  	});
}

function httpGetAsync(theUrl, callback)
{
  $.ajax(theUrl, {  
    data: {  
             
    },
    dataType: 'jsonp',  
    crossDomain: true,  
    success: callback
  });
}

function success(pos) {
  var crd = pos.coords;
  var lat = crd.latitude;
  var lng = crd.longitude;
  weather(lat,lng);
};

function error(err) {
  httpGetAsync('https://freegeoip.net/json', function(data) {
    var lat = data.latitude;
    var lng = data.longitude;
    weather(lat,lng);
  });
};

var options = {
  enableHighAccuracy: true,
  timeout: 5000,
  maximumAge: 0
};

function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(success, error, options);
        
    } else {
        $("#city-name").text("Geolocation is not supported by this browser.");
    }
}