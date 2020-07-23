var requestRunning = false;
// var isRebooting = false;

function poll(data, callback, requestReset) {
    return $.ajax({
        type: 'POST',
        url: getBaseUrl() + 'res.php',
        data: data,
        dataType: 'json',
        success: function (result, status, xhr) {
            if (callback != undefined) {
                callback(result);
            }
        },
        error: function (result, status, xhr) {
            // console.log(result);
        },
        complete: function () {
            if (requestReset != undefined) {
                requestRunning = false;
                // console.log("Ajax complete: requestRunning=" + requestRunning);
            }
        }
    });
}

function getBaseUrl() {
    return '/';
}

function getWebSocketUri() {
    var wsUri;
    if (window.location.protocol === 'https:') {
        wsUri = 'wss://';
    } else {
        wsUri = 'ws://';
    }
    wsUri += window.location.host;
    wsUri += window.location.pathname + 'x'; // fix for IE10 error 12008
    return wsUri;
}

function htmlEncode(value) {
    // create a in-memory div, set it's inner text(which jQuery automatically encodes)
    // then grab the encoded contents back out.  The div never exists on the page.
    return $('<div/>').text(value).html();
}

function htmlDecode(value) {
    return $('<div/>').html(value).text();
}

function sleep(milliSeconds, callback) {
    setTimeout(function () {
        callback();
    }, milliSeconds);
}

function getResource(resource, callback) {
    poll({
        action: 'get',
        resource: resource
    }, callback);
}

function setResource(resource, value, callback, requestReset) {
    return poll({
        action: 'set',
        resource: resource,
        value: value,
    }, callback, requestReset);
}

function getTree(resource, callback) {
    poll({
        action: 'node',
        resource: resource,
    }, callback);
}

// Function to calculate text widths    Example: var txt = "apa"; apa.width();
String.prototype.width = function (font) {
    var f = font || '12px arial';
    var o = $('<div>' + this + '</div>')
            .css({ position: 'absolute', float: 'left', 'white-space': 'nowrap', visibility: 'hidden', font: f })
            .appendTo($('body'));
    var w = o.width();

    o.remove();
    return w;
};

function kelvinToCelsius(t, diff) {
    if (typeof(t) === 'string') {
        if (diff == true) {
            return (parseFloat(t)).toFixed(1).toString();
        }
        return (parseFloat(t) - 273.15).toFixed(1).toString();
    }
    console.log('kelvinToCelsius() - Error');
}

function kelvinToFahrenheit(t, diff) {
    if (typeof(t) == 'string') {
        if (diff == true) {
            return(parseFloat(t) * 1.8).toFixed(1).toString();
        }
        return((parseFloat(t) - 273.15) * 1.8 + 32).toFixed(1).toString();
    }
    console.log('kelvinToFahrenheit() - Error');
}

function kelvinToCurrentTemperatureUnit(t, diff) {
    if ($.cookie('temperatureUnit') === 'celsius') {
        return kelvinToCelsius(t, diff);
    }
    return kelvinToFahrenheit(t, diff);
}

function currentTemperatureUnitToKelvin(t, diff) {
    if ($.cookie('temperatureUnit') == 'celsius') {
        return celsiusToKelvin(t, diff);
    }
    return fahrenheitToKelvin(t, diff);
}

function getCurrentTemperatureUnitString() {
    if ($.cookie('temperatureUnit') === 'celsius') {
        return '&degC';
    }
    return '&degF';
}

function getCurrentDistanceUnitString() {
    if ($.cookie('distanceUnit') === 'metric') {
        return 'm';
    }
    return 'ft';
}

function celsiusToKelvin(t, diff) {
    if (typeof(t) == 'string') {
        if (diff === true) {
            return (parseFloat(t)).toString();
        }
        return (parseFloat(t) + 273.15).toString();
    }
    console.log('celsiusToKelvin() - Error');
}

function fahrenheitToKelvin(t, diff) {
    if (typeof(t) === 'string') {
        if (diff == true) {
            return (parseFloat(t) / 1.8).toString();
        }
        return ((parseFloat(t) - 32) / 1.8 + 273.15).toString();
    } else {
        console.log('fahrenheitToKelvin() - Error');
    }
}

function meterToFeet(t, precision) {
    if (typeof precision === 'undefined') {
        precision = 1;
    }
    if (typeof(t) === 'string') {
        return (parseFloat(t) * 3.28084).toFixed(precision).toString();
    }
    console.log('meterToFeet(): wrong type');
    return '';
}

function feetToMeter(t, precision) {
    if (typeof precision === 'undefined') {
        precision = 1;
    }
    if (typeof(t) === 'string') {
        return (parseFloat(t) * 0.3048).toFixed(precision).toString();
    } else {
        console.log('feetToMeter(): wrong type');
        return '';
    }
}

function currentDistanceUnitToMeter(t, precision) {
    if (typeof precision === 'undefined')
        precision = 1;
    if ($.cookie('distanceUnit') == 'metric') {
        return t;
    } else {
        return feetToMeter(t, precision);
    }
}

function meterToCurrentDistanceUnit(t, precision) {
    if (typeof precision === 'undefined')
        precision = 1;
    if ($.cookie('distanceUnit') == 'metric') {
        return parseFloat(t).toFixed(precision);
    } else {
        return meterToFeet(t, precision);
    }
}

function updateServerTimeZone()
{
    // Find client time zone and daylight savings time
    // (From : http://blog.codez.in/php5-time-zone-solution/web-development/2010/07/09)

    var now = new Date();
    $.cookie('clientTimeZoneOffset', now.getTimezoneOffset(), { expires: 365, path :'/' });

    // Create two new dates
    var d1 = new Date();
    var d2 = new Date();
    // Date one is set to January 1st of this year; Guaranteed not to be in DST for northern hemisphere,
    // and guaranteed to be in DST for southern hemisphere. (If DST exists on client PC)
    d1.setDate(1);
    d1.setMonth(1);
    // Date two is set to July 1st of this year; Guaranteed to be in DST for northern hemisphere,
    // and guaranteed not to be in DST for southern hemisphere. (If DST exists on client PC)
    d2.setDate(1);
    d2.setMonth(7);
    // If time zone offsets match, no DST exists for this time zone
    if(parseInt(d1.getTimezoneOffset()) == parseInt(d2.getTimezoneOffset()))
    {
        $.cookie('clientTimeZoneDST', 0, { expires: 365, path :'/' });
    } else { // DST exists for this time zone – check if it is currently active
        // Find out if we are on northern or southern hemisphere
        // Hemisphere is positive for northern, and negative for southern
        var hemisphere = parseInt(d1.getTimezoneOffset()) - parseInt(d2.getTimezoneOffset());
        // Current date is still before or after DST, not containing DST
        if((hemisphere > 0 && parseInt(d1.getTimezoneOffset()) == parseInt(now.getTimezoneOffset())) ||
            (hemisphere < 0 && parseInt(d2.getTimezoneOffset()) == parseInt(now.getTimezoneOffset()))) {
            $.cookie('clientTimeZoneDST', 0, { expires: 365, path :'/' });
        } // DST is active right now with the current date
        else {
            $.cookie('clientTimeZoneDST', 1, { expires: 365, path :'/' });
        }
    }

    // Tell php to update
    var jqPost = $.post(getBaseUrl() + 'settings/setServerTimeZone/', function () {});
    // window.location = getBaseUrl() + "settings/setServerTimeZone/";
}

function init() {
    clientGUID = generateGUID();

    var jqPost = $.post(getBaseUrl() + 'settings/getDistanceUnit/', function () {})
    .done(function (data) {
        // console.log("init.done: distUnit = " + data);
        $.cookie('distanceUnit', data, { expires: 365, path :'/' });
    });

    var jqPost = $.post(getBaseUrl() + 'settings/getTemperatureUnit/', function () {})
    .done(function (data) {
        // console.log("init.done: tempUnit = " + data);
        $.cookie('temperatureUnit', data, { expires: 365, path :'/' });
    });

    updateServerTimeZone();
}

function connectToWebSocket(waitForConnection, waitCallback) {
    if (WebSocket != undefined) {
        initWebSocket();
        if (waitForConnection == true) {
            setTimeout(function () {
                if (websocket.readyState === 1) {
                    if (waitCallback != null) {
                        waitCallback();
                    }
                    return;
                }
                console.log('Waiting for WebSocket connection...');
                if (websocket != undefined) {
                    websocket = null;
                }
                connectToWebSocket(waitForConnection, waitCallback);
            }, 5000);
        }
    }
}

function webSocketSend(message, arg) {
    if (WebSocket != undefined) {
        if (websocket != undefined) {
            if (websocket.readyState === 1) {
                // Find sender guid
                var a = [];
                a.push({ message: message, sender: clientGUID, arg: arg });
                var msg = { notify:a };
                websocket.send(JSON.stringify(msg));
            }
        }
    }
}

function handleClientNotifications(evnt, page) {
    var msg = evnt.message;
    var sender = evnt.sender;
    var arg = evnt.arg;
    if (sender !== clientGUID) {
        switch (msg) {
        case 'refresh':
            if (arg == page) {
                window.location.reload();
            }
            break;
        case 'reboot':
            alert('The camera has been remotely restarted. Please wait for the camera to restart and then log in again.');
            window.location = getBaseUrl() + 'home/logout';
            break;
        case 'newAddress':
            window.location = arg + page;
            break;
        case 'logout':
            alert('Password(s) has been changed.\nYou will now be logged out. Please log in again.');
            window.location = getBaseUrl() + 'home/logout';
            break;
        case 'firmware':
            alert('The camera firmware is about to be updated.\nYou will now be logged out.');
            window.location = getBaseUrl() + 'home/logout';
            break;
        case 'adminLogin':
            $.get(getBaseUrl() + 'login/echoHasAdminAccess/', function () {})
                    .done(function (isadmin) {
                        if (isadmin == true) {
                            alert('Another admin user logged in.\nYou will now be logged out.');
                            window.location = getBaseUrl() + 'home/logout';
                        }
                    });
            break;
        }
    }
}

function generateGUID() {
    var guid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0;
        var v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
    return guid;
}

// Initialize jQuery
$(function () {
    init();
});
