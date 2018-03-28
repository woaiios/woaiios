var channels = ["freecodecamp","test_channel","ESL_SC2"];
var colors = ["bg-primary", "bg-info", "bg-secondary"];

$(document).ready(function() {
  getChannelInfo();
  getStreamInfo();
});


var allHtml = "";
var onlineHtml = "";
var offlineHtml = "";

var count = 0

function getColor() {
  var index = count % 3;
  count += 1;
  return colors[index];
}

function buildCell(name, iconUrl, dsc, link) {
  var cell =
    '<a href="' + link + '"><div class="row text-center text-white ' + getColor() + '" style="height: 60px">' +
      
      '<div class="col-2 col-md-1 align-self-center">' +
        '<img src="' + iconUrl + '" style="height: 50px; height: 50px;">' +
      '</div>' +
      
      '<div class="col-4 align-self-center textContainer">' +
        '<p class="align-self-center">'+ name + '</p>' +
      '</div>' +

      '<div class="col-6 col-md-7 align-self-center text-truncate textContainer">' +
        '<p>' + dsc + '</p>' +
      '</div>' +

    '</div></a>'

  allHtml = allHtml + cell;
  $("#all").html(allHtml);
  if (dsc == "offline") {
    offlineHtml = offlineHtml + cell;
    $("#offline").html(offlineHtml);
  } else {
    onlineHtml = onlineHtml + cell
    $("#online").html(onlineHtml);
  }
}

function getChannelInfo() {
  var baseUrl = "https://wind-bow.gomix.me/twitch-api/channels/";
  for (var i = 0; i < channels.length; i++) {
    var channel = channels[i];
    var url =  baseUrl + channel;
    $.ajax(url, {  
      data: {  
               
      },
      dataType: 'jsonp',  
      crossDomain: true,  
      success: function(data) {  
        var uri = new URI(this.url);
        var name = uri.filename();
        if (data) {
          var iconUrl = data.logo;
          var des = data.status;
          var link = data.url;
          getStreamInfo(name,iconUrl,des, link, function(data) { 
            var uri = new URI(this.url);
            var name = uri.filename();
            if (data) {
              if (!data.stream) {
                des = "offline";
              }
              buildCell(name, iconUrl, des, link);
              console.log(name);
            }
          });
        }
      }  
    }); 
  }
}

function getStreamInfo(channel, icon, des, link, callback) {
  var baseUrl = "https://wind-bow.gomix.me/twitch-api/streams/";
  var url =  baseUrl + channel;
  $.ajax(url, {  
    data: {  
             
    },
    dataType: 'jsonp',  
    crossDomain: true,  
    success: callback
  });
}

