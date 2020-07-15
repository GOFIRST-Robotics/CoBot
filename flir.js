/* global $, poll, getBaseUrl, getResource, setResource, showNotification, meterToFeet*/
var calibrating = false;
var isotherm = '';
var isothermHighT = 0;
var isothermLowT = 0;
var adjMode = 'auto';
var lockMode = 'none';
var minSpan = '4.0';

function getMeasure(type, id, callback) {
    poll({
        action: 'measurement',
        type: type,
        id: id
    }, callback);
}

function getAlarm(id, callback) {
    poll({
        action: 'alarm',
        id: id
    }, callback);
}

function getGlobalParameters(callback) {
    poll({ action: 'global-parameters' }, callback);
}

function calibrate() {
    poll({ action: 'calibrate' });
}

function refreshImage(rate) {
    var blocked = false;
    var image = document.getElementById('snapshot');
    image.addEventListener('load', function () {blocked = false;});
    image.addEventListener('error', function () {blocked = false;});
    setInterval(function () {
        if (blocked) {
            return;
        }
        blocked = true;
        image.src = 'snapshot.jpg?' + Math.random();
    }, rate);
}

var hflip = false;
var vflip = false;

function updateHorizontalFlip(flipValue) {
    $('#flip-h').prop('checked', flipValue);
    if (flipValue) {
        $('#snapshot').addClass('flip-horizontal');
    } else {
        $('#snapshot').removeClass('flip-horizontal');
    }
    hflip = flipValue;
}

function updateVerticalFlip(flipValue) {
    $('#flip-v').prop('checked', flipValue);
    if (flipValue) {
        $('#snapshot').addClass('flip-vertical');
    } else {
        $('#snapshot').removeClass('flip-vertical');
    }
    vflip = flipValue;
}

function flip(resource, value) {
    setResource('.rtp.web', 'false', function () {
        setResource('rtp.' + resource, value, function () {
            setResource('.rtp.web', 'true', function () {
                window.location.reload();   // Reload to reposition all mfuncs
            });
        });
    });
}

function internalTemp(rate) {
    getResource('.system.tempsens.TSFpa', function (result) {
        $('.internal-temp').html(kelvinToCurrentTemperatureUnit(result, false) + '&nbsp;' + getCurrentTemperatureUnitString());
        setTimeout(function () {
            internalTemp(rate);
        }, rate);
    });
}

function keepAlive(rate) {
    setResource('.rtp.keepalive', 'true', function () {
        setTimeout(function () {
            keepAlive(rate);
        }, rate);
    });
}

function scaleToScreen(val, axis, size) {
    val = parseInt(val, 10);
    var ret = val * globScaling;
    if (axis === 'x') {
        if (hflip) {
            if (size !== undefined) {
                ret = globImgWidth - (parseFloat(val) + parseFloat(size)) * globScaling;
            } else {
                ret = globImgWidth - (val * globScaling) - globScaling;
            }
        }
    } else if (axis === 'y') {
        if (vflip) {
            if (size !== undefined) {
                ret = globImgHeight - (parseFloat(val) + parseFloat(size)) * globScalingHeight;
            } else {
                ret = globImgHeight - (val * globScalingHeight) - globScalingHeight;
            }
        } else {
            ret = val * globScalingHeight;
        }
    } else if (axis === 'width') {
        if (hflip === false) {
            ret += -2;
        }
    } else if (axis === 'height') {
        ret = val * globScalingHeight;
        if (vflip == false) {
            ret += -2;
        }
    }
    return ret;
}

function scaleToSensor(val, axis, size) {
    var ret = val / globScaling;
    if (axis === 'x') {
        if (hflip) {
            if (size != undefined) {
                ret = (globImgWidth - parseFloat(val)) / globScaling - parseFloat(size);
            } else {
                ret = (globImgWidth - parseFloat(val)) / globScaling - 1;
            }
        }
    } else if (axis === 'y') {
        if (vflip) {
            if (size != undefined) {
                ret = (globImgHeight - parseFloat(val)) / globScalingHeight - parseFloat(size);
            } else {
                ret = (globImgHeight - parseFloat(val)) / globScalingHeight - 1;
            }
        } else {
            ret = val / globScalingHeight;
        }
    }
    return Math.round(ret);
}

function moveSpot(id, x, y) {
    var sensorX = scaleToSensor(x, 'x');
    var sensorY = scaleToSensor(y, 'y');
    setResource('.image.sysimg.measureFuncs.spot.' + id + '.x ', sensorX);
    setResource('.image.sysimg.measureFuncs.spot.' + id + '.y ', sensorY);
}

function resizeBox(id, w, h) {
    var sensorW = scaleToSensor(w, 'width');
    var sensorH = scaleToSensor(h, 'height');
    setResource('.image.sysimg.measureFuncs.mbox.' + id + '.width ', sensorW);
    setResource('.image.sysimg.measureFuncs.mbox.' + id + '.height ', sensorH);
}

function moveBox(id, x, y, width, height) {
    var sensorX = scaleToSensor(x, 'x', width);
    var sensorY = scaleToSensor(y, 'y', height);
    setResource('.image.sysimg.measureFuncs.mbox.' + id + '.x ', sensorX);
    setResource('.image.sysimg.measureFuncs.mbox.' + id + '.y ', sensorY);
}

function resizeAndMove(id, x, y, width, height) {
    sensorW = scaleToSensor(width, 'width');
    setResource('.image.sysimg.measureFuncs.mbox.' + id + '.width ', sensorW, function () {
        sensorH = scaleToSensor(height, 'height');
        setResource('.image.sysimg.measureFuncs.mbox.' + id + '.height ', sensorH, function () {
            sensorX = scaleToSensor(x, 'x', width / globScaling);
            setResource('.image.sysimg.measureFuncs.mbox.' + id + '.x ', sensorX, function () {
                sensorY = scaleToSensor(y, 'y', height / globScaling);
                setResource('.image.sysimg.measureFuncs.mbox.' + id + '.y ', sensorY);
            });
        });
    });
}

function updateSymbologyAccess(type, id) {
    // Disable symbology interaction for users with non-access
    $.get(getBaseUrl() + 'login/interactive', function (result) {
        if (result === 'false') {
            $('#' + type + '-' + id).draggable('destroy');
            if (type === 'mbox') {
                $('#' + type + '-' + id).resizable('destroy');
            }
        }
    });
}

function createSpot(id, measureData) {
    $('<div/>', {
        class: 'spot',
        title: 'spot ' + measureData.label,
        id: 'spot-' + id,
    })
    .draggable({
        cursor: 'move',
        containment: '#measurements-container',
        scroll: false,
        grid: [globScaling, globScalingHeight],
        stop: function (event, ui) {
            moveSpot(
                id,
                ui.position.left + spotOffset - gridAlignment,
                ui.position.top + spotOffset - gridAlignment
            );
        }
    })
    .append('<div class="spot-label">' + measureData.label + '</div>')
    .css({
        position: 'absolute',
        left: scaleToScreen(measureData.x, 'x') - spotOffset + gridAlignment,
        top: scaleToScreen(measureData.y, 'y') - spotOffset + gridAlignment,
        'z-index': 1,  // One above boxes to enable grabbing
    })
    .appendTo('#measurements-container');

    updateSymbologyAccess('spot', id);
    updateMeasurementLabel('spot', id, measureData.label);
}

function addSpotRow(id, measureData) {
    if ($('#sidebar-spot-template').length > 0) {
        var source = $('#sidebar-spot-template').html();
        var template = Handlebars.compile(source);
        var valuePrefix = measureData.valueValid === '=' ? '' : measureData.valueValid;
        var context = {
            id: id,
            valuePrefix: valuePrefix,
            tempUnitString: htmlDecode(getCurrentTemperatureUnitString()),
            distUnitString: htmlDecode(getCurrentDistanceUnitString()),
            spotValue: kelvinToCurrentTemperatureUnit(measureData.valueT, false),
            condition: [
                { value: 'BELOW', name: 'Below' },
                { value: 'ABOVE', name: 'Above' }
                /* {"value":"MATCH", "name":"Match"} */
            ],
            value: '0',
            hysteresis: '1',
            threshold: '1',
            capture: ['Image', 'Vide', 'None'],
            duration: ['10 s', '1 s'],
            prerecording: ['1 s', '5 s', '10 s', '60 s'],
            email: false,
            ftp: false,
            disableNuc: false,
            label: measureData.label
        };
        var result = template(context);
        addSortedResult(result, 'spot', id);
    }
    updateMeasurementLabel('spot', id, measureData.label);
}

function createBox(id, measureData) {
    $('<div/>', {
        class: 'mbox',
        title: 'Measurement box ' + measureData.label,
        id: 'mbox-' + id
    })
    .resizable({
        containment: '#measurements-container',
        handles: 'all',
        grid: [globScaling, globScalingHeight],
        start: function (event, ui) {
            $('#mbox-max-' + id).hide();
            $('#mbox-min-' + id).hide();
        },
        stop: function (event, ui) {
            resizeAndMove(id, ui.position.left, ui.position.top, this.clientWidth, this.clientHeight);
            if ($('#mbox-max-' + id).attr('data-calcMaskActive') === 'true') {
                $('#mbox-max-' + id).show();
            }
            if ($('#mbox-min-' + id).attr('data-calcMaskActive') === 'true') {
                $('#mbox-min-' + id).show();
            }
        }
    })
    .draggable({
        containment: '#measurements-container',
        scroll: false,
        grid: [globScaling, globScalingHeight],
        start: function (event, ui) {
            $('#mbox-max-' + id).hide();
            $('#mbox-min-' + id).hide();
        },
        stop: function (event, ui) {
            moveBox(id, ui.position.left, ui.position.top, measureData.width, measureData.height);
            if ($('#mbox-max-' + id).attr('data-calcMaskActive') === 'true') {
                $('#mbox-max-' + id).show();
            }
            if ($('#mbox-min-' + id).attr('data-calcMaskActive') === 'true') {
                $('#mbox-min-' + id).show();
            }
        }
    })
    .append("<div class='mbox-label'>" + id + '</div>')
    .css({
        position: 'absolute',
        left: scaleToScreen(measureData.x, 'x', measureData.width),
        top: scaleToScreen(measureData.y, 'y', measureData.height),
        width: scaleToScreen(measureData.width, 'width'),
        height: scaleToScreen(measureData.height, 'height')
    })
    .appendTo('#measurements-container');

    updateSymbologyAccess('mbox', id);
    updateMeasurementLabel('mbox', id, measureData.label);
}

function createBoxSpotMax(id, measureData) {
    $('<div/>', {
        class: 'mbox-max',
        id: 'mbox-max-' + id,
        title: 'Max',
        'data-calcMaskActive': 'true'
    })
    .appendTo('#measurements-container')
    .css({
        left: scaleToScreen(measureData.maxX, 'x') - spotOffset + gridAlignment,
        top: scaleToScreen(measureData.maxY, 'y') - spotOffset + gridAlignment
    });
}

function createBoxSpotMin(id, measureData) {
    $('<div/>', {
        class: 'mbox-min',
        id: 'mbox-min-' + id,
        title: 'Min',
        'data-calcMaskActive': 'true'
    })
    .appendTo('#measurements-container')
    .css({
        left: scaleToScreen(measureData.minX, 'x') - spotOffset + gridAlignment,
        top: scaleToScreen(measureData.minY, 'y') - spotOffset + gridAlignment
    });
}

function addBoxRow(id, measureData) {
    if ($('#sidebar-mbox-template').length > 0) {
        var source = $('#sidebar-mbox-template').html();
        var template = Handlebars.compile(source);
        var minValuePrefix = measureData.minValid === '=' ? '' : measureData.minValid;
        var maxValuePrefix = measureData.maxValid === '=' ? '' : measureData.maxValid;
        var avgValuePrefix = measureData.avgValid === '=' ? '' : measureData.avgValid;
        var isoValuePrefix = measureData.isoValid === '=' ? '' : measureData.isoValid;
        var context = {
            id: id,
            minValuePrefix: minValuePrefix,
            maxValuePrefix: maxValuePrefix,
            avgValuePrefix: avgValuePrefix,
            isoValuePrefix: isoValuePrefix,
            tempUnitString: htmlDecode(getCurrentTemperatureUnitString()),
            distUnitString: htmlDecode(getCurrentDistanceUnitString()),
            avgT: kelvinToCurrentTemperatureUnit(measureData.avgT, false),
            maxT: kelvinToCurrentTemperatureUnit(measureData.maxT, false),
            minT: kelvinToCurrentTemperatureUnit(measureData.minT, false),
            isoCoverage: measureData.isoCoverage,
            condition: [
                { value: 'BELOW', name: 'Below' },
                { value: 'ABOVE', name: 'Above' },
                /* {"value":"MATCH", "name":"Match"} */
            ],
            value: 0,
            hysteresis: 1,
            threshold: 1,
            capture: ['Image', 'Video', 'None'],
            duration: ['10 s', '1 s'],
            prerecording: ['1 s', '5 s', '10 s', '60 s'],
            email: false,
            ftp: false,
            disableNuc: false,
            label: measureData.label
        };
        var result = template(context);
        addSortedResult(result, 'mbox', id);
    }

    updateMeasurementLabel('mbox', id, measureData.label);
}

function addDeltaRow(id, measureData, alreadyActive) {
    if ($('#sidebar-delta-template').length > 0) {
        var source = $('#sidebar-delta-template').html();
        var template = Handlebars.compile(source);
        var valuePrefix = measureData.valueValid === '=' ? '' : measureData.valueValid;
        var context = {
            id: id,
            valuePrefix: '',
            tempUnitString: htmlDecode(getCurrentTemperatureUnitString()),
            diffValue: 'Config',
            condition: [
                { value: 'BELOW', name: 'Below' },
                { value: 'ABOVE', name: 'Above' }
                /* {"value":"MATCH", "name":"Match"}*/
            ],
            value: '0',
            hysteresis: '1',
            threshold: '1',
            capture: ['Image', 'Video', 'None'],
            duration: ['10 s', '1 s'],
            prerecording: ['1 s', '5 s', '10 s', '60 s'],
            email: false,
            ftp: false,
            disableNuc: false,
            diffInit: !alreadyActive
        };
        var result = template(context);
        addSortedResult(result, 'diff', id);
    }
}

function addSortedResult(result, type, resId) {
    var table = $('.sidebar-content.measurements');
    var children = table.children();
    var currChild = null;
    var nextChild = null;
    $.each(children, function (index, id) {
        var no = (id.id).split('-');
        currChild = $(this);
        no = no[2];
        if (type === 'spot') {
            if (id.className.search('spot') !== -1) {
                if (resId < no) {
                    nextChild = $(this);    // Addee should be added before this item
                    return false;
                }
            } else {
                nextChild = $(this);        // Addee should be added before this item
                return false;
            }
        } else if (type === 'mbox') {
            if (id.className.search('mbox') !== -1) {
                if (resId < no) {
                    nextChild = $(this);    // Addee should be added before this item
                    return false;
                }
            } else if (id.className.search('spot') === -1) {
                nextChild = $(this);        // Addee should be added before this item
                return false;
            }
        } else {
            if (id.className === 'sidebar-item') {
                nextChild = $(this);        // Addee should be added before this item
                return false;
            }
        }
    });

    if (nextChild != null) {
        nextChild.before(result);       // We found an item that should be directly after the new item
    } else {
        currChild.after(result);        // We didn't find any item that should be after the new item
    }
}

function subscribeToSpot(id, callback) {
    $.post(getBaseUrl() + 'home/subscribe/spot/' + id)
        .done(function () {
            console.log('Subscribed to spot ', id);
            if (callback !== undefined) {
                callback();
            }
        });
}

function unsubscribeToSpot(id) {
    $.post(getBaseUrl() + 'home/unsubscribe/spot/' + id)
        .done(function () {
            console.log('Unsubscribed to spot', id);
        });
}

function subscribeToBox(id, callback) {
    $.post(getBaseUrl() + 'home/subscribe/box/' + id)
        .done(function (data) {
            console.log('Subscribed to box ', id);
            if (callback != undefined) {
                callback();
            }
        });
}

function unsubscribeToBox(id) {
    $.post(getBaseUrl() + 'home/unsubscribe/box/' + id)
        .done(function (data) {
            console.log('Unsubscribed to box ' + id);
        });
}

function subscribeToDelta(id) {
    return $.post(getBaseUrl() + 'home/subscribe/delta/' + id)
        .then(function () {
            console.log('Subscribed to delta ', id);
        });
}

function unsubscribeToDelta(id) {
    $.post(getBaseUrl() + 'home/unsubscribe/delta/' + id)
        .done(function (data) {
            console.log('Unsubscribed to delta ' + id);
        });
}

function subscribeToIsotherm(id, callback) {
    $.post(getBaseUrl() + 'home/subscribe/isotherm/' + id)
        .done(function (data) {
            console.log('Subscribed to isotherm ', id);
            if (callback != undefined) {
                callback();
            }
        });
}

function unsubscribeToIsotherm(id) {
    $.post(getBaseUrl() + 'home/unsubscribe/isotherm/' + id)
        .done(function () {
            console.log('Unsubscribed to isotherm ' + id);
        });
}

function subscribeToAlarm(id) {
    $.post(getBaseUrl() + 'home/subscribe/alarm/' + id)
        .done(function () {
            console.log('Subscribed to alarm ' + id);
        });
}

function unsubscribeToAlarm(id) {
    $.post(getBaseUrl() + 'home/unsubscribe/alarm/' + id)
        .done(function () {
            console.log('Unsubscribed to alarm ' + id);
        });
}

function initSubscriptions() {
    console.log('Initializing subscriptions...');
    $.post(getBaseUrl() + 'home/subscribe')
        .done(function () {
            console.log('Subscriptions initialized');
        });
}

function updateGlobalParameters() {
    getGlobalParameters(function (result) {
        $.each(result, function (param, value) {
            if (param === 'ambTemp') {
                $('.global-ambient-temp').val(parseFloat(kelvinToCurrentTemperatureUnit(value)).toFixed(1), false);
            } else if (param === 'atmTemp') {
                $('.global-atmospheric-temp').val(parseFloat(kelvinToCurrentTemperatureUnit(value)).toFixed(1), false);
            } else if (param === 'emissivity') {
                $('.global-emissivity').val(parseFloat(value).toFixed(2));
            } else if (param === 'extOptTemp') {
                $('.global-external-window-temp')
                    .val(parseFloat(kelvinToCurrentTemperatureUnit(value)).toFixed(1), false);
            } else if (param === 'extOptTransmAltVal') {
                $('.global-external-window-transmission').val(parseFloat(value * 100).toFixed(0));
            } else if (param === 'objectDistance') {
                if ($.cookie('distanceUnit') == 'metric') {
                    $('.global-distance').val(parseFloat(value).toFixed(1));
                } else {
                    $('.global-distance').val(parseFloat(meterToFeet(value, 2)));
                }
            } else if (param === 'relHum') {
                $('.global-relative-humidity').val(parseFloat(value * 100).toFixed(0));
            } else if (param === 'extOptTransmAltActive') {
                if (value === 'false') {
                    $('.global-external-window-active').prop('selectedIndex', 1);
                    $('.global-external-window-transmission').attr('disabled', 'disabled');
                    $('.global-external-window-temp').attr('disabled', 'disabled');
                    $('#extOptTempLabel').addClass('text-disabled');
                    $('#extOptTransLabel').addClass('text-disabled');
                } else {
                    $('.global-external-window-active').prop('selectedIndex', 0);
                    $('.global-external-window-transmission').removeAttr('disabled');
                    $('.global-external-window-temp').removeAttr('disabled');
                    $('#extOptTempLabel').removeClass('text-disabled');
                    $('#extOptTransLabel').removeClass('text-disabled');
                }
            }
        });
    });
}

function findFirstInactiveMeasure(list, type) {
    var id = null;
    if (list.length > 0) {
        id = list.shift();
        getMeasure(type, id, function (measureData) {
            if (measureData.active === 'false') {
                initMeasure(type, id, measureData, false);
            } else {
                findFirstInactiveMeasure(list, type);
            }
        });
    } else {
        requestRunning = false;
        if (type === 'spot') {
            alert('You are using the maximum number of spot measurements.');
        } else if (type === 'mbox') {
            alert('You are using the maximum number of box measurements.');
        } else if (type === 'diff') {
            alert('You are using the maximum number of delta measurements.');
        } else {
            alert('You are using the maximum number of measurements of this type.');
        }
    }
}

function initActiveMeasures(type) {
    getTree('.image.sysimg.measureFuncs.' + type, function (list) {
        $.each(list, function (index, id) {
            getMeasure(type, id, function (measureData) {
                if (measureData.active === 'true') {
                    initMeasure(type, id, measureData, true);
                    setTimeout(function () {
                        if (type === 'spot' || type === 'diff') {
                            updateMeasurementValue($('#' + type + '-bar-' + id + ' .measurement-value'), measureData.valueT, type == 'diff' ? true : false);
                            updateMeasurementValueValidity($('#' + type + '-bar-' + id + ' .measurement-value'), measureData.valueValid);
                        } else if (type == 'mbox') {
                            updateMeasurementValue($('#' + type + '-bar-' + id + ' .temp-average'), measureData.avgT, false);
                            updateMeasurementValue($('#' + type + '-bar-' + id + ' .temp-max'), measureData.maxT, false);
                            updateMeasurementValue($('#' + type + '-bar-' + id + ' .temp-min'), measureData.minT, false);
                            updateIsoCoverageValue($('#' + type + '-bar-' + id + ' .temp-iso'), measureData.isoCoverage);
                            updateMeasurementValueValidity($('#' + type + '-bar-' + id + ' .temp-average'), measureData.avgValid);
                            updateMeasurementValueValidity($('#' + type + '-bar-' + id + ' .temp-max'), measureData.maxValid);
                            updateMeasurementValueValidity($('#' + type + '-bar-' + id + ' .temp-min'), measureData.minValid);
                            updateMeasurementValueValidity($('#' + type + '-bar-' + id + ' .temp-iso'), measureData.isoValid);
                        }
                    }, 3000);
                }
            });
        });
    });
}

function synchActiveMeasures(type, id) {
    getMeasure(type, id, function (measureData) {
        if (measureData.active === 'true') {
            initMeasure(type, id, measureData, true);
        }
    });
}

function initMeasure(type, id, measureData, alreadyActive) {
    // console.log(measureData);
    if (type == 'spot') {
        if (!alreadyActive) {
            subscribeToSpot(id, function () {
                setTimeout(function () { // TODO: Remove sleep after usleep in subscriptions.php can be removed
                    setResource('.image.sysimg.measureFuncs.spot.' + id + '.active', 'true', null, true);
                }, 750);
            });
        }
        measureData.label = id;      // Patch label to get unicode text
        createSpot(id, measureData);
        addSpotRow(id, measureData);
    } else if (type === 'mbox') {
        if (!alreadyActive) {
            subscribeToBox(id, function () {
                setTimeout(function () { // TODO: Remove sleep after usleep in subscriptions.php can be removed
                    setResource('.image.sysimg.measureFuncs.mbox.' + id + '.active', 'true', null, true);
                    setResource('.image.sysimg.measureFuncs.mbox.' + id + '.calcMask', '0x1bfc');
                }, 750);
            });
        }
        measureData.label = id;      // Patch label to get unicode text
        createBox(id, measureData);
        createBoxSpotMax(id, measureData);
        createBoxSpotMin(id, measureData);
        addBoxRow(id, measureData);
        updateMeasurementCalcMask(type, id, measureData.calcMask);
    } else if (type === 'diff') {
        // There is only one reftemp available
        setResource('.image.sysimg.measureFuncs.reftemp.1.active', 'true'); // Make sure reftemp.id is active
        if (!alreadyActive) {
            subscribeToDelta(id)
                .then(function () {
                    return setResource('.image.sysimg.measureFuncs.diff.' + id + '.type0', 'reftemp', null, true);
                })
                .then(function () {
                    return setResource('.image.sysimg.measureFuncs.diff.' + id + '.id0', '1', null, true);
                })
                .then(function () {
                    return setResource('.image.sysimg.measureFuncs.diff.' + id + '.type1', 'reftemp', null, true);
                })
                .then(function () {
                    return setResource('.image.sysimg.measureFuncs.diff.' + id + '.id1', '1', null, true);
                })
                .then(function () {
                    return setResource('.image.sysimg.measureFuncs.diff.' + id + '.active', 'true', null, true);
                });
        }
        addDeltaRow(id, measureData, alreadyActive);
    }

    synchAlarm(type, id, false);
}

function synchAlarm(type, id, deactiveInactive) {
    getTree('.image.sysimg.alarms.measfunc', function (alarmList) {
        $.each(alarmList, function (index, alarmId) {
            getAlarm(alarmId, function (result) {
                if (result.measFuncType == type && result.measFuncId == id) {
                    if (result.active === 'true') {
                        if (result.measFuncResType === 'valueT') {
                            $('#' + type + '-bar-' + id + ' .button-alarm')
                                .addClass('button-activated')
                                .find('.alarm-active').val('yes');
                            if (result.trig === 'true') {
                                $('#' + type + '-bar-' + id + ' .button-alarm').addClass('button-alarm-trigged');
                            }
                            // Will generate a data object named measfuncAlarm!
                            if (type === 'spot') {
                                $('#spot-bar-' + id + ' .alarm-temp-spot').attr('data-measfunc-alarm', alarmId);
                            } else {
                                $('#diff-bar-' + id + ' .alarm-temp-delta').attr('data-measfunc-alarm', alarmId);
                            }
                        } else if (result.measFuncResType === 'minT') {
                            $('#mbox-bar-' + id + ' .alarm-temp-min')
                                .addClass('button-activated')
                                .find('.alarm-active').val('yes');
                            if (result.trig === 'true') {
                                $('#mbox-bar-' + id + ' .alarm-temp-min').addClass('button-alarm-trigged');
                            }
                            // Will generate a data object named measfuncAlarm!
                            $('#mbox-bar-' + id + ' .alarm-temp-min').attr('data-measfunc-alarm', alarmId);
                        } else if(result.measFuncResType === 'maxT') {
                            $('#mbox-bar-' + id + ' .alarm-temp-max')
                                .addClass('button-activated')
                                .find('.alarm-active').val('yes');
                            if (result.trig === 'true') {
                                $('#mbox-bar-' + id + ' .alarm-temp-max').addClass('button-alarm-trigged');
                            }
                            // Will generate a data object named measfuncAlarm!
                            $('#mbox-bar-' + id + ' .alarm-temp-max').attr('data-measfunc-alarm', alarmId);
                        } else if(result.measFuncResType === 'avgT') {
                            $('#mbox-bar-' + id + ' .alarm-temp-average')
                                .addClass('button-activated')
                                .find('.alarm-active').val('yes');
                            if (result.trig === 'true') {
                                $('#mbox-bar-' + id + ' .alarm-temp-average').addClass('button-alarm-trigged');
                            }
                            // Will generate a data object named measfuncAlarm!
                            $('#mbox-bar-' + id + ' .alarm-temp-average').attr('data-measfunc-alarm', alarmId);
                        } else if (result.measFuncResType === 'isoCoverage') {
                            $('#mbox-bar-' + id + ' .alarm-temp-iso')
                                .addClass('button-activated')
                                .find('.alarm-active').val('yes');
                            if (result.trig === 'true') {
                                $('#mbox-bar-' + id + ' .alarm-temp-iso').addClass('button-alarm-trigged');
                            }
                            // Will generate a data object named measfuncAlarm!
                            $('#mbox-bar-' + id + ' .alarm-temp-iso').attr('data-measfunc-alarm', alarmId);
                        }
                    } else if (deactiveInactive == true) {
                        if (result.measFuncResType === 'valueT') {
                            $('#' + type + '-bar-' + id + ' .button-alarm')
                                .removeClass('button-activated')
                                .find('.alarm-active').val('no');
                            $('#' + type + '-bar-' + id + ' .button-alarm').removeClass('button-alarm-trigged');
                        } else if (result.measFuncResType === 'minT') {
                            $('#mbox-bar-' + id + ' .alarm-temp-min')
                                .removeClass('button-activated')
                                .find('.alarm-active').val('no');
                        } else if (result.measFuncResType === 'maxT') {
                            $('#mbox-bar-' + id + ' .alarm-temp-max')
                                .removeClass('button-activated')
                                .find('.alarm-active').val('no');
                        } else if (result.measFuncResType === 'avgT') {
                            $('#mbox-bar-' + id + ' .alarm-temp-average')
                                .removeClass('button-activated')
                                .find('.alarm-active').val('no');
                        } else if (result.measFuncResType === 'isoCoverage') {
                            $('#mbox-bar-' + id + ' .alarm-temp-iso')
                                .removeClass('button-activated')
                                .find('.alarm-active').val('no');
                        }
                    }
                }
            });
        });
    });
}

function initInternalTemp() {
    getResource('.resmon.items.tempsens.active', function (result) {
        if (result === 'true') {
            // Will generate a data object named measfuncAlarm!
            $('#tempsens-bar-1').attr('data-measfunc-alarm', 'tempsens');
            $('#tempsens-bar-1 .alarm-temp-internal').attr('data-measfunc-alarm', 'tempsens');

            $('#tempsens-bar-1 .button-alarm')
                .addClass('button-activated')
                .find('.alarm-active').val('yes');

            getResource('.resmon.items.tempsens.trigged', function (result) {
                if (result === 'true') {
                    $('#tempsens-bar-1 .button-alarm').addClass('button-alarm-trigged');
                }
            });

            subscribeToAlarm('tempsens');
        }
    });
}

function initDigitalIn() {
    getResource('.resmon.items.digin.active', function (result) {
        if (result === 'true') {
            // Will generate a data object named measfuncAlarm!
            $('#digin-bar-1').attr('data-measfunc-alarm', 'digin');
            $('#digin-bar-1 .alarm-temp-digin').attr('data-measfunc-alarm', 'digin');

            $('#digin-bar-1 .button-alarm')
                .addClass('button-activated')
                .find('.alarm-active').val('yes');

            getResource('.resmon.items.digin.trigged', function (result) {
                if (result === 'true')
                    $('#digin-bar-1 .button-alarm').addClass('button-alarm-trigged');
            });

            subscribeToAlarm('digin');
        }
    });
}

function findFirstInactiveAlarm(alarmList, callback) {
    if (alarmList.length > 0) {
        id = alarmList.shift();
        getResource('.image.sysimg.alarms.measfunc.' + id + '.active', function (status) {
            if (status === 'false') {
                callback(id);
                return false;
            }
            findFirstInactiveAlarm(alarmList, callback);
        });
    } else {
        alert('All alarms are active. You must inactivate one alarm to activate an alarm on this measurement tool.');
    }
}

function updatePeriodicNuc() {
    getResource('.tcomp.services.autoNuc.onlyInitial', function (auto) {
        getResource('.tcomp.services.autoNuc.maxInterval', function (intervalString) {
            var interval = parseInt(intervalString, 10);
            var list = $('#popup-calibration-settings').children('label');
            $.each(list, function (index, id) {
                var parts = $(this).prop('id').split('-');
                var inp = $(this).children('input');
                if (auto === 'true') {
                    if (parts[1] === 'off') {
                        inp.prop('checked', true);
                    } else {
                        inp.prop('checked', false);
                    }
                } else {
                    if (parts.length === 2) {
                        inp.prop('checked', false);
                    } else if (parseInt(parts[2], 10) * 60 === interval) {
                        inp.prop('checked', true);
                    } else {
                        inp.prop('checked', false);
                    }
                }
            });
        });
    });
}

function removeSpot(id, deactivate) {
    $('#spot-' + id).remove();
    $('#spot-bar-' + id).remove();
    if (deactivate) {
        setResource('.image.sysimg.measureFuncs.spot.' + id + '.active', 'false', function () {
            unsubscribeToSpot(id);
        });
    }
}

function removeBox(id, deactivate) {
    $('#mbox-' + id).remove();
    $('#mbox-max-' + id).remove();
    $('#mbox-min-' + id).remove();
    $('#mbox-bar-' + id).remove();
    if (deactivate) {
        setResource('.image.sysimg.measureFuncs.mbox.' + id + '.active', 'false', function () {
            unsubscribeToBox(id);
        });
    }
}

function removeDelta(id, deactivate) {
    $('#diff-bar-' + id).remove();
    if (deactivate) {
        setResource('.image.sysimg.measureFuncs.diff.' + id + '.active', 'false', function () {
            unsubscribeToDelta(id);
        });
    }
}

function requestFullScreen(elem) {
    // ## The below if statement seems to work better ## if ((document.fullScreenElement && document.fullScreenElement !== null) || (document.msfullscreenElement && document.msfullscreenElement !== null) || (!document.mozFullScreen && !document.webkitIsFullScreen)) {
    if ((document.fullScreenElement !== undefined && document.fullScreenElement === null) || (document.msFullscreenElement !== undefined && document.msFullscreenElement === null) || (document.mozFullScreen !== undefined && !document.mozFullScreen) || (document.webkitIsFullScreen !== undefined && !document.webkitIsFullScreen)) {
        if (elem.requestFullScreen) {
            elem.requestFullScreen();
        } else if (elem.mozRequestFullScreen) {
            elem.mozRequestFullScreen();
        } else if (elem.webkitRequestFullScreen) {
            elem.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
        } else if (elem.msRequestFullscreen) {
            elem.msRequestFullscreen();
        }
    } else {
        if (document.cancelFullScreen) {
            document.cancelFullScreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.webkitCancelFullScreen) {
            document.webkitCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }

    $('#snapshot').css({ width: '100%', height: '100%' });
    $('#measurements-container').css({ width: '100%', height: '100%' });
}

function updateMeasurementValue(element, v, diff) {
    var label = element.attr('data-label');
    var prefix = element.attr('data-value-prefix');
    var value = kelvinToCurrentTemperatureUnit(v, diff);
    if (diff) {
        if (element.attr('data-init') == 'true') {
            element.html('Config');
            // element.css("color", "blue");
        } else {
            element.attr('data-value', value);
            element.html(label + prefix + value + '&nbsp;' + getCurrentTemperatureUnitString());
            // element.css("color", "black");
        }
    } else {
        element.attr('data-value', value);
        element.html(label + prefix + value + '&nbsp;' + getCurrentTemperatureUnitString());
    }
}

function updateIsoCoverageValue(element, v) {
    var label = element.attr('data-label');
    var prefix = element.attr('data-value-prefix');
    element.attr('data-value', v);
    element.html(label + prefix + element.attr('data-value') + '&nbsp;%');
}

function updateMeasurementValueValidity(element, v) {
    var label = element.attr('data-label');
    if (element.attr('data-init') === 'true') {
        element.html('Config');
        // element.css("color", "blue");
    } else {
        if (v === '=') {
            element.attr('data-value-prefix', '');
            element.html(label + element.attr('data-value') + '&nbsp;' + getCurrentTemperatureUnitString());
        } else {
            element.attr('data-value-prefix', v);
            element.html(label + element.attr('data-value-prefix') + element.attr('data-value') + '&nbsp;' + getCurrentTemperatureUnitString());
        }
    }
}

function updateMeasurementCalcMask(type, id, calcMask) {
    if (type === 'mbox') {
        // Markers
        if ((calcMask & 8) > 0 && (calcMask & 4)) {
            $('#mbox-max-' + id).show();
            $('#mbox-max-' + id).attr('data-calcMaskActive', 'true');
        } else {
            $('#mbox-max-' + id).hide();
            $('#mbox-max-' + id).attr('data-calcMaskActive', 'false');
        }
        if ((calcMask & 32) > 0 && (calcMask & 16)) {
            $('#mbox-min-' + id).show();
            $('#mbox-min-' + id).attr('data-calcMaskActive', 'true');
        } else {
            $('#mbox-min-' + id).hide();
            $('#mbox-min-' + id).attr('data-calcMaskActive', 'false');
        }
        // Results
        var row = $('#' + type + '-bar-' + id);
        if (row.length === 0) {
            // If there is no bar, there is nothing to update
            return;
        }
        var value = row.children('.temp-max');
        var alarm = row.children('.alarm-temp-max');
        var br = row.children('.max-br');
        var first = true;
        if (calcMask & 4) {
            value.show();
            alarm.show();
            br.show();
            first = false;
        } else {
            value.hide();
            alarm.hide();
            br.hide();
        }
        value = row.children('.temp-min');
        alarm = row.children('.alarm-temp-min');
        br = row.children('.min-br');
        if (calcMask & 16) {
            value.show();
            alarm.show();
            br.show();
            if (first) {
                value.prop('style').width = '108px';
                first = false;
            } else {
                value.prop('style').width = '178px';
            }
        } else {
            value.hide();
            alarm.hide();
            br.hide();
        }
        value = row.children('.temp-average');
        alarm = row.children('.alarm-temp-average');
        br = row.children('.avg-br');
        if (calcMask & 64) {
            value.show();
            alarm.show();
            br.show();
            if (first) {
                value.prop('style').width = '108px';
                first = false;
            } else {
                value.prop('style').width = '178px';
            }
        } else {
            value.hide();
            alarm.hide();
            br.hide();
        }
        value = row.children('.temp-iso');
        alarm = row.children('.alarm-temp-iso');
        if (calcMask & 1024) {
            value.show();
            alarm.show();
            if (first) {
                value.prop('style').width = '108px';
                first = false;
            } else {
                value.prop('style').width = '178px';
            }
        } else {
            value.hide();
            alarm.hide();
            br.hide();
        }
    }
}

function updateMeasurementLabel(type, id, v) {
    var mfunc = $('#' + type + '-' + id);
    var labl = mfunc.find('.spot-label, .mbox-label');
    var tp = type;
    var titl;
    labl.html(v);
    labl.css('width', v.width() + 5);
    if (tp === 'spot') {
        tp = 'Spot';
    } else if (tp === 'mbox') {
        tp = 'Box';
    }
    mfunc.prop('title', tp + ' ' + v);

    mfunc = $('#' + type + '-bar-' + id);
    labl = mfunc.find('.spot-label');
    labl.html(v);
    labl.css('width', v.width() + 5);
    titl = mfunc.find('.button');
    titl.prop('title', tp + ' ' + v);
}

var globIrImgWidth = 80;
var globIrImgHeight = 60;
var globScaling = 8;
var globScalingHeight = 8;
var spotOffset = 15;    // size/2
var gridAlignment = globScaling / 2;

var globSpotGridOffsetX = 0;
var globSpotGridOffsetY = 116;
var globImgHeight = 480;
var globImgWidth = 640;

function recalculateScaling() {
    // Check displayed image size
    globImgWidth = $('#snapshot').width();
    globImgHeight = $('#snapshot').height();

    // Calculate scaling
    globScaling = globImgWidth / globIrImgWidth;
    globScalingHeight = globImgHeight / globIrImgHeight;
    gridAlignment = globScaling / 2;

    // Check measurements-container position
    var main_marg_left = $('.main-container').css('margin-left');
    var img_marg_left = $('#image-container').css('margin-left');
    globSpotGridOffsetX = parseInt(main_marg_left) + parseInt(img_marg_left);
    var panel_marg = $('.panel').css('margin-bottom').replace('px', '');
    var panel_top = $('#panel-top').css('height').replace('px', '');
    var main_top = $('.main-container.camera').css('top').replace('px', '');
    globSpotGridOffsetY = parseFloat(panel_marg) + parseFloat(panel_top) + parseFloat(main_top);

    // Update .draggable for all spots (box is handled by its div)
    var drag_area_left = globSpotGridOffsetX - spotOffset + gridAlignment;
    var drag_area_top = globSpotGridOffsetY - spotOffset + gridAlignment;
    var drag_area_width = globImgWidth + drag_area_left - spotOffset + gridAlignment;
    var drag_area_height = globImgHeight + drag_area_top - spotOffset + gridAlignment;
    $.each($('#measurements-container').children('.spot'), function (index, spot) {
        $(spot).draggable('option', 'containment', '#measurements-container');
        $(spot).draggable('option', 'grid', [globScaling, globScalingHeight]);
    });
    $.each($('#measurements-container').children('.mbox'), function (index, mbox) {
        $(mbox).draggable('option', 'grid', [globScaling, globScaling]);
        $(mbox).resizable('option', 'grid', [globScaling, globScalingHeight]);
    });

    // Update position for all spots
    getTree('.image.sysimg.measureFuncs.spot', function (list) {
        $.each(list, function (index, id) {
            getMeasure('spot', id, function (measureData) {
                if (measureData.active === 'true') {
                    $('#spot-' + id).css({
                        left: scaleToScreen(measureData.x, 'x') - spotOffset + gridAlignment,
                        top: scaleToScreen(measureData.y, 'y') - spotOffset + gridAlignment,
                    });
                }
            });
        });
    });

    // Update size/position for all box
    getTree('.image.sysimg.measureFuncs.mbox', function (list) {
        $.each(list, function (index, id) {
            getMeasure('mbox', id, function (measureData) {
                if (measureData.active === 'true') {
                    $('#mbox-' + id).css({
                        left: scaleToScreen(measureData.x, 'x', measureData.width),
                        top: scaleToScreen(measureData.y, 'y', measureData.height),
                        width: scaleToScreen(measureData.width, 'width'),
                        height: scaleToScreen(measureData.height, 'height')
                    });
                    var $marker = $('#mbox-max-' + id);
                    if ($marker.attr('data-calcMaskActive') === 'true') {
                        $marker.css({
                            left: scaleToScreen(measureData.maxX, 'x') - spotOffset + gridAlignment,
                            top: scaleToScreen(measureData.maxY, 'y') - spotOffset + gridAlignment
                        });
                    }

                    $marker = $('#mbox-min-' + id);
                    if ($marker.attr('data-calcMaskActive') === 'true') {
                        $marker.css({
                            'left': scaleToScreen(measureData.minX, 'x') - spotOffset + gridAlignment,
                            'top' : scaleToScreen(measureData.minY, 'y') - spotOffset + gridAlignment
                        });
                    }
                }
            });
        });
    });
}

function initCamera() {
    // Check actual ir image size
    $.post(getBaseUrl() + 'home/echoIRGeometry/')
        .done(function (data) {
            var geom = data.split(',');
            globIrImgWidth = geom[0];
            globIrImgHeight = geom[1];
            recalculateScaling();
        })
        .fail(function (data) {
            console.log('echoIRGeometry failed: ' + data);
        });

    fetch('/camera/status', { credentials: 'same-origin' })
        .then(function parseInitJson(response) { return response.json(); })
        .then(function updateInitialFusionDistance(data) {
            updateFusionDistance(data.distance);
            updateHorizontalFlip(data.horizontalFlip);
            updateVerticalFlip(data.verticalFlip);
            if (data.imageState === 'FREEZE') {
                $('#button-pause').hide();
                $('#button-play').show();
            }
        });

    getResource('.power.states.digin1', function (result) {
        if (result === 'false') {
            $('.digital-io-value').html('0');
        } else if (result === 'true') {
            $('.digital-io-value').html('1');
        }
    });

    updateViewMode();

    updatePalette();

    updateLamp();

    getResource('.image.contadj.adjMode', function (result) {
        adjMode = result;
        getResource('.image.contadj.lockMode', function (result) {
            lockMode = result;
            updateScaleMode();
            getResource('.image.sysimg.basicImgData.extraInfo.highT', function (result) {
                $('.temp-global-max').data('value', result);
                $('.temp-global-max').val(kelvinToCurrentTemperatureUnit(result, false));
            });
            getResource('.image.sysimg.basicImgData.extraInfo.lowT', function (result) {
                $('.temp-global-min').data('value', result);
                $('.temp-global-min').val(kelvinToCurrentTemperatureUnit(result, false));
            });
        });
    });

    updateGlobalParameters();

    updatePeriodicNuc();

    updateLog();
}

var websocket = undefined;

function initWebSocket() {
    // create a new WebSocket object.
    var wsUri = getWebSocketUri();
    websocket = new WebSocket(wsUri);
    websocket.onopen = function (ev) { // connection is open
        console.log('Connected to WebSocket server');
    };

    websocket.onmessage = function (ev) {
        var msg = JSON.parse(ev.data); // PHP sends Json data
        // console.log(msg);

        $.each(msg, function (k, v) {
            if (k === 'notify') {
                handleClientNotifications(v[0], 'index');
            } else {
                var res = k.slice(1).split('.');
                if (res[2] === 'measureFuncs') {
                    switch (res[5]) {
                    case 'x':
                        if(res[3] === 'spot') {
                            $('#spot-' + res[4]).css('left', scaleToScreen(v, 'x') - spotOffset + gridAlignment);
                        } else {
                            var width = $('#' + res[3] + '-' + res[4]).css('width');
                            width = width.replace('px', '');
                            $('#' + res[3] + '-' + res[4]).css('left', scaleToScreen(v, 'x', width / globScaling));
                        }
                        break;
                    case 'y':
                        if(res[3] === 'spot') {
                            $('#spot-' + res[4]).css('top', scaleToScreen(v, 'y') - spotOffset + gridAlignment);
                        } else {
                            var height = $('#' + res[3] + '-' + res[4]).css('height');
                            height = height.replace('px', '');
                            $('#' + res[3] + '-' + res[4]).css('top', scaleToScreen(v, 'y', height / globScalingHeight));
                        }
                        break;
                    case 'valueT':
                        updateMeasurementValue($('#' + res[3] + '-bar-' + res[4] + ' .measurement-value'), v, res[3] == 'diff' ? true : false);
                        break;
                    case 'valueValid':
                        updateMeasurementValueValidity($('#' + res[3] + '-bar-' + res[4] + ' .measurement-value'), v);
                        break;
                    case 'width':
                        $('#' + res[3] + '-' + res[4]).css('width', scaleToScreen(v, 'width'));
                        break;
                    case 'height':
                        $('#' + res[3] + '-' + res[4]).css('height', scaleToScreen(v, 'height'));
                        break;
                    case 'maxX':
                        $('#' + res[3] + '-max-' + res[4]).css('left', scaleToScreen(v, 'x') - spotOffset + gridAlignment);
                        break;
                    case 'maxY':
                        $('#' + res[3] + '-max-' + res[4]).css('top', scaleToScreen(v, 'y') - spotOffset + gridAlignment);
                        break;
                    case 'minX':
                        $('#' + res[3] + '-min-' + res[4]).css('left', scaleToScreen(v, 'x') - spotOffset + gridAlignment);
                        break;
                    case 'minY':
                        $('#' + res[3] + '-min-' + res[4]).css('top', scaleToScreen(v, 'y') - spotOffset + gridAlignment);
                        break;
                    case 'avgT':
                        updateMeasurementValue($('#' + res[3] + '-bar-' + res[4] + ' .temp-average'), v, false);
                        break;
                    case 'maxT':
                        updateMeasurementValue($('#' + res[3] + '-bar-' + res[4] + ' .temp-max'), v, false);
                        break;
                    case 'minT':
                        updateMeasurementValue($('#' + res[3] + '-bar-' + res[4] + ' .temp-min'), v, false);
                        break;
                    case 'avgValid':
                        updateMeasurementValueValidity($('#' + res[3] + '-bar-' + res[4] + ' .temp-average'), v);
                        break;
                    case 'maxValid':
                        updateMeasurementValueValidity($('#' + res[3] + '-bar-' + res[4] + ' .temp-max'), v);
                        break;
                    case 'minValid':
                        updateMeasurementValueValidity($('#' + res[3] + '-bar-' + res[4] + ' .temp-min'), v);
                        break;
                    case 'calcMask':
                        updateMeasurementCalcMask(res[3], res[4], v);
                        break;
                    case 'isoCoverage':
                        updateIsoCoverageValue($('#' + res[3] + '-bar-' + res[4] + ' .temp-iso'), v);
                        break;
                    case 'isoValid':
                        updateMeasurementValueValidity($('#' + res[3] + '-bar-' + res[4] + ' .temp-iso'), v);
                        break;
                    case 'highT':
                        isothermHighT = v;
                        updateIsotherm();
                        if (isotherm === 'interval' || isotherm === 'below') {
                            $('#iso-value-high').val(kelvinToCurrentTemperatureUnit(v, false));
                        } else if (isotherm === 'above') {
                            $('#iso-value-low').val(kelvinToCurrentTemperatureUnit(v, false));
                        }
                        break;
                    case 'lowT':
                        isothermLowT = v;
                        updateIsotherm();
                        if (isotherm === 'interval') {
                            $('#iso-value-low').val(kelvinToCurrentTemperatureUnit(v, false));
                        }
                        break;
                    case 'type':
                        isotherm = v;
                        updateIsotherm();
                        break;
                    case 'active':
                        var mfunc = $('#' + res[3] + '-' + res[4]);
                        var id = mfunc.prop('id');
                        if (v == 'true') {
                            if (typeof mfunc === 'undefined' || typeof id === 'undefined') { // mfunc does not exist, it must have be created externally. synch up.
                                synchActiveMeasures(res[3], res[4]);
                            }
                        } else {
                            if (typeof id !== 'undefined') { // mfunc does exist, it must have be deleted externally. synch up.
                                if (res[3] === 'spot') {
                                    removeSpot(res[4], false);
                                } else if (res[3] === 'mbox') {
                                    removeBox(res[4], false);
                                } else if (res[3] === 'diff') {
                                    removeDelta(res[4], false);
                                }
                            }
                        }
                        break;
                    }
                } else if(res[0] == 'resmon' && res[1] == 'items') {
                    switch (res[3]) {
                    case 'trigged':
                        var alarmId = res[2];
                        if (v === 'true') {
                            var butt = $('.sidebar-content.measurements').find(".button[data-measfunc-alarm='" + alarmId + "']");
                            if (butt !== undefined && butt.hasClass('button-activated'))
                                butt.addClass('button-alarm-trigged');
                        } else {
                            $('.sidebar-content.measurements').find(".button[data-measfunc-alarm='" + alarmId + "']").removeClass('button-alarm-trigged');
                        }
                        setTimeout(function () {
                            updateLog();    // Need to wait until file is written
                        }, 2000);
                        break;
                    }
                } else if (k.lastIndexOf('.image.sysimg.alarms.measfunc', 0) === 0) {
                    var alarm = k.split('.')[5];
                    getAlarm(alarm, function (data) {
                        synchAlarm(data.measFuncType, data.measFuncId, v === 'true' ? false : true);
                    });
                } else if (k === '.image.sysimg.basicImgData.extraInfo.highT') {
                    var old = $('.temp-global-max').data('value');
                    if (Math.abs(old - v) > 0.1) {
                        $('.temp-global-max').data('value', v);
                        $('.temp-global-max').val(kelvinToCurrentTemperatureUnit(v, false));
                        if (isotherm != '')
                            updateIsotherm();
                    }
                } else if (k === '.image.sysimg.basicImgData.extraInfo.lowT') {
                    var old = $('.temp-global-min').data('value');
                    if (Math.abs(old - v) > 0.1) {
                        $('.temp-global-min').data('value', v);
                        $('.temp-global-min').val(kelvinToCurrentTemperatureUnit(v, false));
                        if (isotherm != '')
                            updateIsotherm();
                    }
                } else if (k === '.image.sysimg.basicImgData.objectParams') {
                    updateGlobalParameters();
                } else if (k === '.image.services.store.stage.start') {
                    showNotification('Saving...');
                } else if (k === '.image.services.store.stage.end') {
                    getResource('.image.services.store.filename', function (result) {
                        var file = result.replace(/^.*(\\|\/|\:)/, '');
                        showNotification(file + ' saved');
                        webSocketSend('refresh', 'storage');
                    });
                } else if (k === '.image.services.store.status') {
                    if (v !== 0 && v !== 0x64090002) {  // show all errors except done and unfinished
                        showNotification('Save error: ' + v);
                    }
                } else if (k === '.image.services.profile.status') {
                    if (parseInt(v, 10) === 0x64090002) {
                        showNotification('Applying preset...');
                        setTimeout(function () {
                            window.location.reload();
                        }, 5000);
                    } else if (v != 0) {
                        showNotification('Failed to apply preset');
                    }
                } else if (k === '.image.state.freeze.stage.end') {
                    if (calibrating == false) {
                        $('#button-pause').hide();
                        $('#button-play').show();
                    }
                } else if (k === '.image.state.live.stage.end') {
                    if (calibrating == false) {
                        $('#button-pause').show();
                        $('#button-play').hide();
                    }
                } else if (k === '.image.services.nuc.stage.start') {
                    calibrating = true;
                    showNotification('Calibrating...', 'calibrate');
                } else if(k === '.image.services.nuc.stage.end') {
                    calibrating = false;
                    hideNotification('calibrate');
                } else if (k === '.image.contadj.adjMode') {
                    adjMode = v;
                    updateScaleMode();
                } else if (k === '.image.contadj.lockMode') {
                    lockMode = v;
                    updateScaleMode();
                } else if (k === '.tcomp.services.autoNuc.onlyInitial') {
                    updatePeriodicNuc();
                } else if (k === '.tcomp.services.autoNuc.maxInterval') {
                    updatePeriodicNuc();
                } else if (k === '.image.sysimg.fusion.fusionData.fusionMode' ||
                         k === '.image.sysimg.fusion.fusionData.useLevelSpan') {
                    updateViewMode();
                } else if (k === '.image.fusion.userDistance') {
                    updateFusionDistance(parseFloat(v));
                } else if (k === '.system.vcam.torch') {
                    updateLamp();
                } else if (k === '.rtp.vflip' || k === '.rtp.hflip') {
                    window.location.reload();   // We will only get this message if caused by other client
                } else if (k === '.image.sysimg.palette.readFile') {
                    updatePalette();
                } else if (k === '.power.states.digin1') {
                    if (v === 'false') {
                        $('.digital-io-value').html('0');
                    } else if (v === 'true') {
                        $('.digital-io-value').html('1');
                    }
                }
            }
        });
    };

    websocket.onerror = function (ev) {
        console.log('WebSocket error occured: ' + ev.data);
    };

    websocket.onclose = function (ev) {
        console.log('WebSocket connection closed');
    };
}

function hideNotification(messageKey) {
    if ($('.notification').attr('data-message-key') === messageKey) {
        clearTimeout(notificationTimeout);
        hideCurrentNotification();
    }
}

function hideCurrentNotification() {
    $('.notification').attr('data-message-key', '');
    $('#notification-text').html('');
    $('.notification').prop('style').display = 'none';
}

function showNotification(text, messageKey) {
    if ($('.notification').length === 0) {
        return;
    }
    if (messageKey !== undefined) {
        $('.notification').attr('data-message-key', messageKey);
    }

    $('#notification-text').html(text);
    $('.notification').prop('style').display = 'inline-block';
    var wd = $('#measurements-container').width();
    $('.notification').width(wd - 1);
    notificationTimeout = setTimeout(function () {
        hideCurrentNotification();
    }, 5000);
}

var notificationTimeout;    // Needed to handle new notifications before old timeout

function updateIsotherm() {
    var max = $('.temp-global-max').data('value');
    var min = $('.temp-global-min').data('value');
    var scaleHeight = parseFloat($('.scale').css('height').replace('px', ''));
    var top;
    var bottom;
    if (isotherm === 'above') {
        var height = Math.min((max - isothermHighT) / (max - min) * scaleHeight, scaleHeight);
        $('.isotherm').css('height', height + 'px');
        $('.isotherm').css('top', '40px');
        return;
    } else if (isotherm === 'below') {
        var y = Math.min(Math.max((max - isothermHighT) / (max - min) * scaleHeight, 0), scaleHeight);
        var height = scaleHeight - y;
        y += 40;
        $('.isotherm').css('height', height + 'px');
        $('.isotherm').css('top', y + 'px');
        return;
    }
    top = 40 + Math.max(Math.min((max - isothermHighT) / (max - min) * scaleHeight, scaleHeight), 0);
    bottom = 40 + Math.min((max - isothermLowT) / (max - min) * scaleHeight, scaleHeight);
    $('.isotherm').css('top', top + 'px');
    $('.isotherm').css('height', (bottom - top) + 'px');
    return;
}

function updateScaleMode() {
    if (adjMode === 'auto') {
        if (lockMode === 'high') {
            $('.button-auto-max').css('display', 'inline-block');
            $('.temp-global-max').addClass('manual');
            $('.temp-global-min').removeClass('manual');
            $('.button-auto-min').css('display', 'none');
        } else if (lockMode === 'low') {
            $('.button-auto-max').css('display', 'none');
            $('.button-auto-min').css('display', 'inline-block');
            $('.temp-global-max').removeClass('manual');
            $('.temp-global-min').addClass('manual');
        } else {
            $('.button-auto-max').css('display', 'none');
            $('.button-auto-min').css('display', 'none');
            $('.temp-global-max').removeClass('manual');
            $('.temp-global-min').removeClass('manual');
        }
    } else {
        $('.button-auto-max').css('display', 'inline-block');
        $('.button-auto-min').css('display', 'inline-block');
        $('.temp-global-max').addClass('manual');
        $('.temp-global-min').addClass('manual');
    }
}

function updateLog() {
    $.post(getBaseUrl() + 'home/getLogContent/', function () {})
        .fail(function () {
            console.log('Error. Could not get log content.');
        })
        .done(function (result) {
            if (result.indexOf('FLIR') === -1)
            {
                var res = JSON.parse(result);
                var txt = '';
                $.each(res, function (index, grej) {
                    txt += grej.time + ': ' + grej.type + ' ' + grej.id;
                    if (isNaN(grej.value) == false) {
                        txt += ' = ' + kelvinToCurrentTemperatureUnit(grej.value, grej.type === 'diff') + getCurrentTemperatureUnitString();
                    } else if (grej.value == 'ON') {
                        txt += ' = 1';
                    } else if (grej.value == 'OFF') {
                        txt += ' = 0';
                    }
                    if (typeof grej.action !== 'undefined') {
                        txt += '\n=> ' + grej.action;
                    }
                    if (index < res.length - 1) {
                        txt += '<hr>';
                    }
                });
                $('#log-container').html(txt);
            }
        });
    // window.location = getBaseUrl() + "home/getLogContent/";
}

function updateViewMode() {
    $.post(getBaseUrl() + 'home/getviewmode')
        .done(function (data) {
            switch(data) {
            case 'MSX':
            case 'FUSION':
                $('input[name=image-mode][value=FUSION]').prop('checked', true);
                break;
            case 'IR':
                $('input[name=image-mode][value=IR]').prop('checked', true);
                break;
            case 'VISUAL':
                $('input[name=image-mode][value=VISUAL]').prop('checked', true);
                break;
            default:
            }
        });
}

function updateFusionDistance(result) {
    var $temp;
    if ($.cookie('distanceUnit') === 'metric') {
        $temp = result.toFixed(1);
        $('#distance-value').html($temp + ' m');
        $('#slider-distance').slider('value', result * 100);
    } else {
        $temp = meterToFeet(result.toString());
        $('#distance-value').html($temp + ' ft');
        $('#slider-distance').slider('value', $temp * 100);
    }
}

function updateLamp() {
    getResource('.system.vcam.torch', function (result) {
        if (result === 'true') {
            $('input[name=lamp][value=true]').prop('checked', true);
        } else {
            $('input[name=lamp][value=false]').prop('checked', true);
        }
    });
}

function updatePalette() {
    getResource('.image.sysimg.palette.readFile', function (pal) {
        var palette = pal.replace(/^.*(\\|\/|\:)/, '');
        palette = palette.replace('.pal', '');
        getResource('.image.sysimg.measureFuncs.isotherm.1.active', function (iso) {
            if (iso === 'true') {
                getResource('.image.sysimg.measureFuncs.isotherm.1.type', function (isoType) {
                    var color = 'yellow';
                    $('.scale').prop('id', palette);
                    palette = palette + '-iso-' + isoType;
                    $('.select-palette').val(palette);
                    $('.isotherm').css('display', 'inline-block');
                    if (isoType === 'above') {
                        color = 'red';
                        $('#iso-value-high').attr('disabled', 'disabled');
                        $('#iso-value-high').val('Max');
                    } else if (isoType === 'below') {
                        color = 'blue';
                        $('#iso-value-low').attr('disabled', 'disabled');
                        $('#iso-value-low').val('Min');
                    }
                    $('.isotherm').css('background-color', color);
                    $('.isotherm').css('opacity', 0.6);
                    isotherm = isoType;
                });
                getResource('.image.sysimg.measureFuncs.isotherm.1.highT', function (iso) {
                    isothermHighT = iso;
                    if (isotherm == 'above') {
                        $('#iso-value-low').val(kelvinToCurrentTemperatureUnit(iso, false));
                    } else if (isotherm == 'below') {
                        $('#iso-value-high').val(kelvinToCurrentTemperatureUnit(iso, false));
                    } else {
                        $('#iso-value-high').val(kelvinToCurrentTemperatureUnit(iso, false));
                    }
                });
                getResource('.image.sysimg.measureFuncs.isotherm.1.lowT', function (iso) {
                    isothermLowT = iso;
                    if (isotherm == 'interval')
                        $('#iso-value-low').val(kelvinToCurrentTemperatureUnit(iso, false));
                });
                $('.temp-global-max').data('value', '0');  // Just make sure this prop exists
                $('.temp-global-min').data('value', '0');
                $('.isotherm-values').show();
            } else {
                $('.select-palette').val(palette);
                $('.scale').prop('id', palette);
                $('.isotherm').css('display', 'none');
                isotherm = '';
                $('.isotherm-values').hide();
            }
        });
    });
}

// Initialize jQuery
$(function () {
    if (WebSocket === undefined) {
        alert('This browser does not support WebSockets. The web page will not function properly.');
    }

    connectToWebSocket(true);

    initCamera();

    initActiveMeasures('spot');
    initActiveMeasures('mbox');
    initActiveMeasures('diff');
    subscribeToIsotherm('1', null);
    initInternalTemp();
    initDigitalIn();
    initSubscriptions();

    refreshImage(100);
    keepAlive(30000);
    internalTemp(5000);

    $(document.body).on('click', '.button-delete-row', function () {
        var a = $(this).parent().prop('id').split('-');
        var type = a[0];
        var id = a[2];

        if (type === 'spot') {
            removeSpot(id, true);
        } else if (type === 'mbox') {
            removeBox(id, true);
        } else if (type === 'diff') {
            removeDelta(id, true);
        }

        var alarmIds = [];
        $.each($(this).siblings('.button-alarm'), function (index, button) {
            if ($(button).attr('data-measfunc-alarm')) {
                alarmIds.push($(button).attr('data-measfunc-alarm'));
            }
        });

        $.each(alarmIds, function (index, alarmId) {
            setResource('.image.sysimg.alarms.measfunc.' + alarmId + '.active', 'false');
            unsubscribeToAlarm(alarmId);
        });

        // setResource(".resmon.reinit", "true");
        $(this).parents('.button-alarm').removeClass('button-activated');
        $(this).parents('.button-alarm').removeClass('button-alarm-trigged');
        $(this).parent().remove();
    });

    $(window).on('fullscreen-on', function () {
        $('#snapshot').css('width', 'auto');
    });
    $(window).on('fullscreen-off', function () {
        $('#snapshot').css('width', '100%');
    });

    $(window).bind('beforeunload', function (event) {
        if (websocket !== undefined) {
            websocket.onclose = function () {};
            websocket.close();
            websocket = null;
        }
    });

    $('.sidebar-title').on('click', function (e) {
        $(this).next().toggle();
    });


    $('[name=lamp]').change(function () {
        var value = $(this).val();
        setResource('.system.vcam.torch', value);
    });

    $('[name=image-mode]').change(function () {
        var mode = $(this).val();

        $.post(getBaseUrl() + 'home/setviewmode/' + mode)
            .done(function (data) {
                // /console.log("Current viewmode " + data);
            });
    });

    $('#createSpot').on('click', function () {
        if (requestRunning == true) {
            return;
        }
        requestRunning = true;
        showMFuncs();
        getTree('.image.sysimg.measureFuncs.spot', function (result) {
            findFirstInactiveMeasure(result, 'spot');
        });
    });

    $('#createBox').on('click', function () {
        if (requestRunning == true) {
            return;
        }
        requestRunning = true;
        showMFuncs();
        getTree('.image.sysimg.measureFuncs.mbox', function (result) {
            findFirstInactiveMeasure(result, 'mbox');
        });
    });

    $('#createDelta').on('click', function () {
        if (requestRunning == true) {
            return;
        }
        requestRunning = true;
        showMFuncs();
        getTree('.image.sysimg.measureFuncs.diff', function (result) {
            findFirstInactiveMeasure(result, 'diff');
        });
    });

    function showMFuncs() {
        var markers = $('.mbox-max, .mbox-min');
        $('.spot, .mbox').show();
        $.each(markers, function (index, id) {
            if ($(this).attr('data-calcMaskActive') == 'true')
                $(this).show();
        });
    }

    $('#button-calibrate').on('click', function () {
        calibrate();
    });

    $('.calibration-settings').on('change', function () {
        var parts = $(this).prop('id').split('-');
        if (parts[1] === 'off') {
            setResource('.tcomp.services.autoNuc.onlyInitial', true);
        } else {
            setResource('.tcomp.services.autoNuc.onlyInitial', false);
            setResource('.tcomp.services.autoNuc.maxInterval', parts[2] * 60);
        }
    });

    $('#button-pause').on('click', function () {
        setResource('.image.state.freeze.set', 'true', function () {
            sleep(1500, function () {
                showNotification('Live stream is paused');
            });
        });
    });

    $('#button-play').on('click', function () {
        setResource('.image.state.live.set', 'true');
    });

    $('#button-fullscreen').on('click', function () {
        requestFullScreen($('#measurements-container')[0]);
    });

    $('#button-hide').on('click', function () {
        var mfuncs = $('.spot, .mbox');
        var markers = $('.mbox-max, .mbox-min');
        if (mfuncs.css('display') == 'none') {
            mfuncs.show();
            $.each(markers, function (index, id) {
                if ($(this).attr('data-calcMaskActive') == 'true') {
                    $(this).show();
                }
            });
        } else {
            mfuncs.hide();
            markers.hide();
        }
    });

    $('#slider-distance').slider({
        min: 20,
        max: 300,
        slide: function (event, ui) {
            var $temp;
            if ($.cookie('distanceUnit') == 'metric') {
                $('#distance-value').html((ui.value / 100).toFixed(1) + ' m');
            } else {
                $temp = meterToFeet((ui.value / 100).toString());
                $('#distance-value').html($temp + ' ft');
            }
        },
        stop: function (event, ui) {
            setResource('.image.fusion.userDistance', ui.value / 100);
        }
    });

    $('#flip-h').change(function (e) {
        flip('hflip', e.target.checked ? 'true' : 'false');
    });

    $('#flip-v').change(function (e) {
        flip('vflip', e.target.checked ? 'true' : 'false');
    });

    $('.temp-global-max').on('focus', function () {
        if (adjMode === 'auto') {
            if (lockMode === 'low') {
                setResource('.image.contadj.adjMode', 'manual');
                setResource('.image.contadj.lockMode', 'none');
            } else {
                setResource('.image.contadj.lockMode', 'high');
            }
            $('.button-auto-max').css('display', 'inline-block');
        }
    });

    $('.temp-global-max').on('change', function () {
        var val = parseFloat($(this).val());
        if (verifyReflectedTemp(val)) {
            var low = parseFloat($('.temp-global-min').data('value'));
            val = currentTemperatureUnitToKelvin($(this).val(), false);
            if (val < (low + parseFloat(minSpan))) {
                alert('The high temperature value should be ' + kelvinToCurrentTemperatureUnit(minSpan, true) + htmlDecode(getCurrentTemperatureUnitString()) + ' above the low temperature.');
                val = low + parseFloat(minSpan);
                $('.temp-global-max').val(kelvinToCurrentTemperatureUnit(val.toString(), false));
            }
            setResource('.image.sysimg.basicImgData.extraInfo.highT', val);
        } else {
            getResource('.image.sysimg.basicImgData.extraInfo.highT', function (res) {
                $('.temp-global-max').val(kelvinToCurrentTemperatureUnit(res, false));
            });
        }
    });

    $('.temp-global-min').on('focus', function () {
        if (adjMode === 'auto') {
            if (lockMode === 'high') {
                setResource('.image.contadj.adjMode', 'manual');
                setResource('.image.contadj.lockMode', 'none');
            } else {
                setResource('.image.contadj.lockMode', 'low');
            }
            $('.button-auto-min').css('display', 'inline-block');
        }
    });

    $('.temp-global-min').on('change', function () {
        var val = parseFloat($(this).val());
        if (verifyReflectedTemp(val)) {
            var high = parseFloat($('.temp-global-max').data('value'));
            val = currentTemperatureUnitToKelvin($(this).val(), false);
            if (val > (high - parseFloat(minSpan))) {
                alert('The low temperature value should be ' + kelvinToCurrentTemperatureUnit(minSpan, true) + htmlDecode(getCurrentTemperatureUnitString()) + ' below the high temperature.');
                val = high - parseFloat(minSpan);
                $('.temp-global-min').val(kelvinToCurrentTemperatureUnit(val.toString(), false));
            }
            setResource('.image.sysimg.basicImgData.extraInfo.lowT', val);
        } else {
            getResource('.image.sysimg.basicImgData.extraInfo.lowT', function (res) {
                $('.temp-global-max').val(kelvinToCurrentTemperatureUnit(res, false));
            });
        }
    });

    $('.button-auto-max').on('click', function () {
        if (adjMode === 'manual') {
            setResource('.image.contadj.lockMode', 'low');
            setResource('.image.contadj.adjMode', 'auto');
            $('.button-auto-max').css('display', 'none');
        } else if (lockMode === 'high') {
            setResource('.image.contadj.lockMode', 'none');
            $('.button-auto-max').css('display', 'none');
        } else if (lockMode === 'low') {
            setResource('.image.contadj.adjMode', 'manual');
            setResource('.image.contadj.lockMode', 'none');
            $('.button-auto-max').css('display', 'inline-block');
        }
    });

    $('.button-auto-min').on('click', function () {
        if (adjMode === 'manual') {
            setResource('.image.contadj.lockMode', 'high');
            setResource('.image.contadj.adjMode', 'auto');
            $('.button-auto-min').css('display', 'none');
        } else if (lockMode === 'low') {
            setResource('.image.contadj.lockMode', 'none');
            $('.button-auto-min').css('display', 'none');
        } else if (lockMode === 'high') {
            setResource('.image.contadj.adjMode', 'manual');
            setResource('.image.contadj.lockMode', 'none');
            $('.button-auto-min').css('display', 'inline-block');
        }
    });

    $(document.body).on('click', '#measurement-diff-value', function () {
        var prnt = $(this).parents('.diff-bar');
        var element = prnt.children('.measurement-value');
        if (element.attr('data-init') == 'true')
            $('#delta-config-button').click();
    });

    $(document.body).on('click', '.button-alarm', function () {
        var popup = $(this).children('.popup-alarm');
        var button = $(this);
        var pos = $(this).position();
        var buttonLeftMargin = parseInt($(this).css('margin-left'));
        var buttonHeight = $(this).outerHeight();
        var buttonWidth = $(this).outerWidth();
        var isDiff = $(this).hasClass('alarm-temp-delta');
        var isInternal = $(this).hasClass('alarm-temp-internal');
        var isDigin = $(this).hasClass('alarm-temp-digin');
        var isIso = $(this).hasClass('alarm-temp-iso');

        if ($(this).hasClass('button-activated')) {
            popup.show().css({
                left: pos.left - popup.outerWidth() + buttonWidth + buttonLeftMargin,
                top: pos.top + buttonHeight + 4
            });
            var alarmId = button.attr('data-measfunc-alarm');
            synchPopupFromAlarm(popup, alarmId, isDiff, isInternal, isIso, isDigin);
        } else {
            if (isInternal) {
                button.attr('data-measfunc-alarm', 'tempsens');
                popup.show().css({
                    left: pos.left - popup.outerWidth() + buttonWidth + buttonLeftMargin,
                    top: pos.top + buttonHeight + 4
                });
                synchPopupFromAlarm(popup, 'tempsens', isDiff, isInternal, isIso, isDigin);
            } else if (isDigin) {
                button.attr('data-measfunc-alarm', 'digin');
                popup.show().css({
                    'left': pos.left - popup.outerWidth() + buttonWidth + buttonLeftMargin,
                    'top': pos.top + buttonHeight + 4
                });
                synchPopupFromAlarm(popup, 'digin', isDiff, isInternal, isIso, isDigin);
            } else {
                getTree('.image.sysimg.alarms.measfunc', function (result) {
                    result.pop(); // Reserve the last alarm element for batch alarm.
                    findFirstInactiveAlarm(result, function (id) {
                    // Will generate a data object named measfuncAlarm!
                        button.attr('data-measfunc-alarm', id);
                        popup.show().css({
                            left: pos.left - popup.outerWidth() + buttonWidth + buttonLeftMargin,
                            top: pos.top + buttonHeight + 4
                        });
                        synchPopupFromAlarm(popup, id, isDiff, isInternal, isIso, isDigin);
                    });
                });
            }
        }
    });

    function synchPopupFromAlarm(popup, alarmId, isDiff, isInternal, isIso, isDigin) {
        if (isInternal) {
            getResource('.resmon.items.' + alarmId + '.settings.condition', function (result) {
                popup.find('.alarm-condition').val(result);
            });
            getResource('.resmon.items.' + alarmId + '.settings.value', function (result) {
                popup.find('.alarm-value').val(kelvinToCurrentTemperatureUnit(result, isDiff));
            });
            getResource('.resmon.items.' + alarmId + '.settings.hysteresis', function (result) {
                popup.find('.alarm-hysteresis').val(kelvinToCurrentTemperatureUnit(result, true));
            });
            getResource('.resmon.items.' + alarmId + '.settings.duration', function (result) {
                popup.find('.alarm-threshold').val(result);
            });
            synchPopupFromResmon(popup, alarmId);
            popup.find('#threshold-value-id').val('Threshold (' + getCurrentTemperatureUnitString() + '):');
            popup.find('#hysteresis-id').val('Hysteresis (' + getCurrentTemperatureUnitString() + '):');
        } else if (isDigin) {
            getResource('.resmon.items.' + alarmId + '.settings.value', function (result) {
                if (result === 'true') {
                    popup.find('.alarm-value').val(1);
                } else {
                    popup.find('.alarm-value').val(0);
                }
            });
            getResource('.resmon.items.' + alarmId + '.settings.duration', function (result) {
                popup.find('.alarm-threshold').val(result);
            });
            synchPopupFromResmon(popup, alarmId);
        } else {
            getAlarm(alarmId, function (result) {
                var value = kelvinToCurrentTemperatureUnit(result.measFuncThresholdTemp, isDiff);
                var hyst = kelvinToCurrentTemperatureUnit(result.hysteresis, true);
                if (isIso) {
                    value = result.measFuncThresholdTemp;
                    hyst = result.hysteresis;
                }
                popup.find('.alarm-condition').val(result.type);
                var valueField = popup.find('.alarm-value');
                valueField.val(
                    result.active === 'true' ? Math.round(value, 2) : valueField.data('default')
                );
                var hysteresisField = popup.find('.alarm-hysteresis');
                hysteresisField.val(
                    result.active === 'true' ? Math.round(hyst, 2) : hysteresisField.data('default')
                );
                var thresholdField = popup.find('.alarm-threshold');
                thresholdField.val(
                    result.active === 'true' ? Math.round(result.duration, 0) : thresholdField.data('default')
                );

                synchPopupFromResmon(popup, alarmId);
            });
        }
    }

    function synchPopupFromResmon(popup, alarmId) {
        var storeImage = false;
        var storeMovie = false;
        console.log('synchPopupFromResmon: ' + alarmId);
        getResource('.resmon.items.' + alarmId + '.actions.storeImage', function (result) {
            storeImage = result;
            getResource('.resmon.items.' + alarmId + '.actions.storeMovie', function (result) {
                storeMovie = result;
                if (storeMovie === 'true') {
                    popup.find('.alarm-capture option').eq(1).prop('selected', true);
                } else if (storeImage === 'true') {
                    popup.find('.alarm-capture option').eq(0).prop('selected', true);
                } else {
                    popup.find('.alarm-capture option').eq(2).prop('selected', true);
                }

                var emailImage = false;
                var emailMovie = false;
                getResource('.resmon.items.' + alarmId + '.actions.mailImage', function (result) {
                    emailImage = result;
                    getResource('.resmon.items.' + alarmId + '.actions.mailMovie', function (result) {
                        emailMovie = result;
                        if ((emailImage == 'true' && storeImage == 'true') || (emailMovie == 'true' && storeMovie == 'true')) {
                            popup.find('.alarm-action-email').prop('checked', true);
                        } else {
                            popup.find('.alarm-action-email').prop('checked', false);
                        }
                    });
                });

                var ftpImage = false;
                var ftpMovie = false;
                getResource('.resmon.items.' + alarmId + '.actions.sendImage', function (result) {
                    ftpImage = result;
                    getResource('.resmon.items.' + alarmId + '.actions.sendMovie', function (result) {
                        ftpMovie = result;
                        if ((ftpImage === 'true' && storeImage === 'true') || (ftpMovie == 'true' && storeMovie == 'true')) {
                            popup.find('.alarm-action-ftp').prop('checked', true);
                        } else {
                            popup.find('.alarm-action-ftp').prop('checked', false);
                        }
                    });
                });
                getResource('.resmon.items.' + alarmId + '.actions.disableNuc', function (result) {
                    if (result === 'true') {
                        popup.find('.alarm-action-disableNuc').prop('checked', true);
                    } else {
                        popup.find('.alarm-action-disableNuc').prop('checked', false);
                    }
                });
            });
            getResource('.resmon.items.' + alarmId + '.actions.setOutput', function (result) {
                if (result == 1) {
                    popup.find('.alarm-action-digital').prop('checked', true);
                    popup.find('.alarm-output-pulse').removeAttr('disabled');
                } else {
                    popup.find('.alarm-action-digital').prop('checked', false);
                    popup.find('.alarm-output-pulse').attr('disabled', 'disabled');
                }
            });
            getResource('.resmon.items.' + alarmId + '.actions.pulseTime', function (result) {
                popup.find('.alarm-output-pulse').val(result);
            });
        });
    }

    $(document.body).on('click', '.popup-alarm', function (e) {
        e.stopPropagation();
    });

    $(document.body).on('change', '.alarm-active', function (e) {
        var DOMid = $(this).parents('.sidebar-item').prop('id');
        var a = DOMid.split('-');
        var type = a[0];
        var id = a[2];
        var button = $(this).parents('.button-alarm');
        var alarmId = button.attr('data-measfunc-alarm');
        var isInternal = button.hasClass('alarm-temp-internal');
        var isDigin = button.hasClass('alarm-temp-digin');
        var isIso = $(this).parents('.button-alarm').hasClass('alarm-temp-iso');

        if ($(this).val() === 'yes') {
            subscribeToAlarm(alarmId);

            if (!isInternal && !isDigin) {
                setResource('.image.sysimg.alarms.measfunc.' + alarmId + '.measFuncType', type);
                setResource('.image.sysimg.alarms.measfunc.' + alarmId + '.measFuncId', id);
                if ($(this).parents('.button-alarm').hasClass('alarm-temp-max')) {
                    setResource('.image.sysimg.alarms.measfunc.' + alarmId + '.measFuncResType', 'maxT');
                } else if ($(this).parents('.button-alarm').hasClass('alarm-temp-min')) {
                    setResource('.image.sysimg.alarms.measfunc.' + alarmId + '.measFuncResType', 'minT');
                } else if ($(this).parents('.button-alarm').hasClass('alarm-temp-average')) {
                    setResource('.image.sysimg.alarms.measfunc.' + alarmId + '.measFuncResType', 'avgT');
                } else if ($(this).parents('.button-alarm').hasClass('alarm-temp-spot') ||
                        $(this).parents('.button-alarm').hasClass('alarm-temp-delta')) {
                    setResource('.image.sysimg.alarms.measfunc.' + alarmId + '.measFuncResType', 'valueT');
                } else if (isIso) {
                    setResource('.image.sysimg.alarms.measfunc.' + alarmId + '.measFuncResType', 'isoCoverage');
                }
            }

            if (isInternal || isDigin) {
                setResource('.resmon.items.' + alarmId + '.active', 'true');
                reinitResmon();
            } else {
                setResource('.image.sysimg.alarms.measfunc.' + alarmId + '.active', 'true');
            }

            $(this).parents('.button-alarm').addClass('button-activated');

            var popup = button.children('.popup-alarm');
            if (!isInternal && !isDigin) {
                getAlarm(alarmId, function (result) {
                    var thres = kelvinToCurrentTemperatureUnit(result.measFuncThresholdTemp, type === 'diff' ? true : false);
                    var hyst = kelvinToCurrentTemperatureUnit(result.hysteresis, true);
                    if (isIso) {
                        thres = result.measFuncThresholdTemp;
                        hyst = result.hysteresis;
                    }
                    popup.find('.alarm-condition').val(result.type);
                    popup.find('.alarm-value').val(thres);
                    popup.find('.alarm-hysteresis').val(hyst);
                    popup.find('.alarm-threshold').val(result.duration);
                });
            }
            getResource('.resmon.items.' + alarmId + '.trigged', function (res) {
                if (res === 'true')
                    popup.parents('.button-alarm').addClass('button-alarm-trigged');
            });
        } else {
            unsubscribeToAlarm(alarmId);
            if (isInternal || isDigin) {
                setResource('.resmon.items.' + alarmId + '.active', 'false');
                reinitResmon();
            } else {
                setResource('.image.sysimg.alarms.measfunc.' + alarmId + '.active', 'false');
            }

            $(button).removeClass('button-activated');
            $(button).removeClass('button-alarm-trigged');
        }
    });

    $(document.body).on('change', '.alarm-condition', function () {
        var button = $(this).parents('.button-alarm');
        var alarmId = button.attr('data-measfunc-alarm');
        var isInternal = button.hasClass('alarm-temp-internal');
        var val = $(this).val();
        if (isInternal) {
            setResource('.resmon.items.' + alarmId + '.settings.condition', val);
            reinitResmon();
        } else {
            setResource('.image.sysimg.alarms.measfunc.' + alarmId + '.type', val);
        }
    });

    $(document.body).on('change', '.alarm-value', function () {
        if (!this.validity.valid) {
            if (this.max !== undefined && parseInt(this.value, 10) > parseInt(this.max, 10)) {
                this.value = this.max;
            }
            if (this.min !== undefined && parseInt(this.value, 10) < parseInt(this.min, 10)) {
                this.value = this.min;
            }
            return;
        }
        var button = $(this).parents('.button-alarm');
        var alarmId = button.attr('data-measfunc-alarm');
        var isInternal = button.hasClass('alarm-temp-internal');
        var isDigin = button.hasClass('alarm-temp-digin');
        var isIso = button.hasClass('alarm-temp-iso');
        var DOMid = $(this).parents('.sidebar-item').prop('id');
        var a = DOMid.split('-');
        var type = a[0];
        var val = currentTemperatureUnitToKelvin($(this).val(), type == 'diff');
        if (isIso) {
            val = $(this).val();
        }
        if (isInternal) {
            setResource('.resmon.items.' + alarmId + '.settings.value', val);
            reinitResmon();
        } else if (isDigin) {
            if ($(this).val() == 0 || $(this).val() == 1) {
                if ($(this).val() == 0) {
                    val = 'false';
                } else {
                    val = 'true';
                }
                setResource('.resmon.items.' + alarmId + '.settings.value', val);
                reinitResmon();
            } else {
                alert('Incorrect value: Should be 0 or 1.');
            }
        } else {
            setResource('.image.sysimg.alarms.measfunc.' + alarmId + '.measFuncThresholdTemp', val);
        }
    });

    $(document.body).on('change', '.alarm-hysteresis', function (e) {
        var button = $(this).parents('.button-alarm');
        var alarmId = button.attr('data-measfunc-alarm');
        var isInternal = button.hasClass('alarm-temp-internal');
        var isIso = button.hasClass('alarm-temp-iso');
        var val = currentTemperatureUnitToKelvin($(this).val(), true);
        if (isIso) {
            val = $(this).val();
        }
        if (isInternal) {
            setResource('.resmon.items.' + alarmId + '.settings.hysteresis', val);
            reinitResmon();
        } else {
            setResource('.image.sysimg.alarms.measfunc.' + alarmId + '.hysteresis', val);
        }
    });

    $(document.body).on('change', '.alarm-threshold', function (e) {
        var button = $(this).parents('.button-alarm');
        var alarmId = button.attr('data-measfunc-alarm');
        var isInternal = button.hasClass('alarm-temp-internal');
        var isDigin = button.hasClass('alarm-temp-digin');
        var val = $(this).val();
        if (isInternal || isDigin) {
            setResource('.resmon.items.' + alarmId + '.settings.duration', val);
            reinitResmon();
        } else {
            setResource('.image.sysimg.alarms.measfunc.' + alarmId + '.duration', val);
        }
    });

    $(document.body).on('change', '.alarm-capture', function (e) {
        var alarmId = $(this).parents('.button-alarm').attr('data-measfunc-alarm');
        var index = $(this).find(':selected').index();

        if (index == 0) {
            // Image
            setResource('.resmon.items.' + alarmId + '.actions.storeImage', 'true');
            setResource('.resmon.items.' + alarmId + '.actions.storeMovie', 'false');

            var popup = $(this).parents('.popup-alarm');
            var chkBx = $(popup).find('.alarm-action-email');
            var email = chkBx.prop('checked');
            if (email == true) {
                setResource('.resmon.items.' + alarmId + '.actions.mailImage', 'true');
                setResource('.resmon.items.' + alarmId + '.actions.mailMovie', 'false');
            } else {
                setResource('.resmon.items.' + alarmId + '.actions.mailImage', 'false');
                setResource('.resmon.items.' + alarmId + '.actions.mailMovie', 'false');
            }
            var chkBx = $(popup).find('.alarm-action-ftp');
            var ftp = chkBx.prop('checked');
            if (ftp == true) {
                setResource('.resmon.items.' + alarmId + '.actions.sendImage', 'true');
                setResource('.resmon.items.' + alarmId + '.actions.sendMovie', 'false');
            } else {
                setResource('.resmon.items.' + alarmId + '.actions.sendImage', 'false');
                setResource('.resmon.items.' + alarmId + '.actions.sendMovie', 'false');
            }
        } else if (index == 1) {
            // Video
            setResource('.resmon.items.' + alarmId + '.actions.storeImage', 'false');
            setResource('.resmon.items.' + alarmId + '.actions.storeMovie', 'true');

            var popup = $(this).parents('.popup-alarm');
            var chkBx = $(popup).find('.alarm-action-email');
            var email = chkBx.prop('checked');
            if (email == true) {
                setResource('.resmon.items.' + alarmId + '.actions.mailImage', 'false');
                setResource('.resmon.items.' + alarmId + '.actions.mailMovie', 'true');
            } else {
                setResource('.resmon.items.' + alarmId + '.actions.mailImage', 'false');
                setResource('.resmon.items.' + alarmId + '.actions.mailMovie', 'false');
            }
            var chkBx = $(popup).find('.alarm-action-ftp');
            var ftp = chkBx.prop('checked');
            if (ftp == true) {
                setResource('.resmon.items.' + alarmId + '.actions.sendImage', 'false');
                setResource('.resmon.items.' + alarmId + '.actions.sendMovie', 'true');
            } else {
                setResource('.resmon.items.' + alarmId + '.actions.sendImage', 'false');
                setResource('.resmon.items.' + alarmId + '.actions.sendMovie', 'false');
            }
        } else if (index == 2) {
            // Video
            setResource('.resmon.items.' + alarmId + '.actions.storeImage', 'false');
            setResource('.resmon.items.' + alarmId + '.actions.storeMovie', 'false');

            var popup = $(this).parents('.popup-alarm');
            var chkBx = $(popup).find('.alarm-action-email');
            var email = chkBx.prop('checked');
            if (email == true) {
                setResource('.resmon.items.' + alarmId + '.actions.mailImage', 'false');
                setResource('.resmon.items.' + alarmId + '.actions.mailMovie', 'false');
            } else {
                setResource('.resmon.items.' + alarmId + '.actions.mailImage', 'false');
                setResource('.resmon.items.' + alarmId + '.actions.mailMovie', 'false');
            }
            var chkBx = $(popup).find('.alarm-action-ftp');
            var ftp = chkBx.prop('checked');
            if (ftp == true) {
                setResource('.resmon.items.' + alarmId + '.actions.sendImage', 'false');
                setResource('.resmon.items.' + alarmId + '.actions.sendMovie', 'false');
            } else {
                setResource('.resmon.items.' + alarmId + '.actions.sendImage', 'false');
                setResource('.resmon.items.' + alarmId + '.actions.sendMovie', 'false');
            }
        }
    });

    $(document.body).on('change', '.alarm-action-overlay', function () {
        var alarmId = $(this).parents('.button-alarm').attr('data-measfunc-alarm');
        if ($(this).prop('checked') == true) {
            setResource('.resmon.items.' + alarmId + '.actions.enableOverlay', 'true');
        }else{
            setResource('.resmon.items.' + alarmId + '.actions.enableOverlay', 'false');
        }
    });
    $(document.body).on('change', '.alarm-action-nuc', function () {
        var alarmId = $(this).parents('.button-alarm').attr('data-measfunc-alarm');
        if ($(this).prop('checked') == true) {
            setResource('.resmon.items.' + alarmId + '.actions.disableNuc', 'true');
        } else {
            setResource('.resmon.items.' + alarmId + '.actions.disableNuc', 'false');
        }
    });
    $(document.body).on('change', '.alarm-action-digital', function () {
        var alarmId = $(this).parents('.button-alarm').attr('data-measfunc-alarm');
        if ($(this).prop('checked') == true) {
            setResource('.resmon.items.' + alarmId + '.actions.setOutput', '1');
            $(document.body).find('.alarm-output-pulse').removeAttr('disabled');
        } else {
            setResource('.resmon.items.' + alarmId + '.actions.setOutput', '0');
            $(document.body).find('.alarm-output-pulse').attr('disabled', 'disabled');
        }
    });
    $(document.body).on('change', '.alarm-output-pulse', function () {
        var alarmId = $(this).parents('.button-alarm').data('measfuncAlarm');
        var val = $(this).val();
        if (val < 0) {
            alert('Incorrect value: Should be above 0.');
        } else {
            setResource('.resmon.items.' + alarmId + '.actions.pulseTime', val);
        }
        // reinitResmon();
    });
    $(document.body).on('change', '.alarm-action-email', function () {
        var alarmId = $(this).parents('.button-alarm').attr('data-measfunc-alarm');
        var dis = $(this);
        getResource('.resmon.items.' + alarmId + '.actions.storeImage', function (status) {
            if (dis.prop('checked') == true) {
                if (status === 'true') {
                    setResource('.resmon.items.' + alarmId + '.actions.mailImage', 'true');
                    setResource('.resmon.items.' + alarmId + '.actions.mailMovie', 'false');
                } else {
                    setResource('.resmon.items.' + alarmId + '.actions.mailImage', 'false');
                    setResource('.resmon.items.' + alarmId + '.actions.mailMovie', 'true');
                }
            } else {
                setResource('.resmon.items.' + alarmId + '.actions.mailImage', 'false');
                setResource('.resmon.items.' + alarmId + '.actions.mailMovie', 'false');
            }
        });
    });
    $(document.body).on('change', '.alarm-action-ftp', function () {
        var alarmId = $(this).parents('.button-alarm').attr('data-measfunc-alarm');
        var dis = $(this);
        getResource('.resmon.items.' + alarmId + '.actions.storeImage', function (status) {
            if (dis.prop('checked') == true) {
                if (status == 'true') {
                    setResource('.resmon.items.' + alarmId + '.actions.sendImage', 'true');
                    setResource('.resmon.items.' + alarmId + '.actions.sendMovie', 'false');
                } else {
                    setResource('.resmon.items.' + alarmId + '.actions.sendImage', 'false');
                    setResource('.resmon.items.' + alarmId + '.actions.sendMovie', 'true');
                }
            } else {
                setResource('.resmon.items.' + alarmId + '.actions.sendImage', 'false');
                setResource('.resmon.items.' + alarmId + '.actions.sendMovie', 'false');
            }
        });
    });

    $(document.body).on('change', '.alarm-action-disableNuc', function () {
        var alarmId = $(this).parents('.button-alarm').attr('data-measfunc-alarm');
        if ($(this).prop('checked') == true) {
            setResource('.resmon.items.' + alarmId + '.actions.disableNuc', 'true');
        } else {
            setResource('.resmon.items.' + alarmId + '.actions.disableNuc', 'false');
        }
    });

    function reinitResmon() {  // Needed when changing resmon.items.settings directly. Not needed when done through sysimg.alarms.
        setTimeout(function () {
            setResource('.resmon.reinit', 'true');
        }, 1000);
    }

    $(document.body).on('click', '.button-spot', function () {
        var popup = $(this).children('.popup-spot');
        var pos = $(this).position();
        var buttonLeftMargin = parseInt($(this).css('margin-left'));
        var buttonHeight = $(this).outerHeight();
        var buttonWidth = $(this).outerWidth();
        popup.show().css({
            left: pos.left + (window.matchMedia('(min-width: 1070px)').matches ? -popup.outerWidth() + buttonWidth + buttonLeftMargin : 0),
            top: pos.top + buttonHeight + 4
        });
        synchPopupFromMFunc(popup);
    });

    $(document.body).on('click', '.button-mbox', function () {
        var popup = $(this).children('.popup-mbox');
        var pos = $(this).position();
        var buttonLeftMargin = parseInt($(this).css('margin-left'));
        var buttonHeight = $(this).outerHeight();
        var buttonWidth = $(this).outerWidth();
        popup.show().css({
            left: pos.left + (window.matchMedia('(min-width: 1070px)').matches ? -popup.outerWidth() + buttonWidth + buttonLeftMargin : 0),
            top: pos.top + buttonHeight + 4
        });
        synchPopupFromMFunc(popup);
    });

    $(document.body).on('click', '#delta-config-button', function () {
        var popup = $(this).children('.popup-diff');
        var pos = $(this).position();
        var buttonLeftMargin = parseInt($(this).css('margin-left'));
        var buttonHeight = $(this).outerHeight();
        var buttonWidth = $(this).outerWidth();
        popup.show().css({
            left: pos.left + (window.matchMedia('(min-width: 1070px)').matches ? -popup.outerWidth() + buttonWidth + buttonLeftMargin : 0),
            top: pos.top + buttonHeight + 4
        });
        synchPopupFromDiff(popup);

        var prnt = popup.parents('.diff-bar');
        var element = prnt.children('.measurement-value');
        element.removeAttr('data-init');

        updateMeasurementValue(element, '0', true);
    });

    $(document.body).on('click', '.popup-spot', function (e) {
        e.stopPropagation();    // Prevent clicks in popup from propagating to button
    });

    $(document.body).on('click', '.popup-mbox', function (e) {
        e.stopPropagation();    // Prevent clicks in popup from propagating to button
    });

    $(document.body).on('click', '.popup-diff', function (e) {
        e.stopPropagation();    // Prevent clicks in popup from propagating to button
    });

    function synchPopupFromMFunc(popup) {
        var mfunc = popup.prop('id');
        if (typeof mfunc === 'undefined') {
            return;
        }
        mfunc = mfunc.split('-');
        var type = mfunc[0];
        var id = mfunc[1];
        getMeasure(type, id, function (measureData) {
            popup.find('.local-emissivity').val(parseFloat(measureData.emissivity).toFixed(2));
            popup.find('.local-reftemp').val(kelvinToCurrentTemperatureUnit(measureData.ambTemp));
            popup.find('.local-distance').val(meterToCurrentDistanceUnit(measureData.objectDistance));

            popup.find('.mfunc-label').val(id);  // Patch label to get unicode text

            if ((measureData.parMask & 7) > 0) {
                popup.find('.local-active option').eq(0).prop('selected', true);
                $('.local-emissivity').removeAttr('disabled');
                $('.local-reftemp').removeAttr('disabled');
                $('.local-distance').removeAttr('disabled');
            }
            else {
                popup.find('.local-active option').eq(1).prop('selected', true);
                $('.local-emissivity').attr('disabled', 'disabled');
                $('.local-reftemp').attr('disabled', 'disabled');
                $('.local-distance').attr('disabled', 'disabled');
                resetLocalParameters(popup);
            }

            if (type === 'mbox') {
                var calMask = measureData.calcMask;
                if ((calMask & 4) > 0) {
                    popup.find('.measure-box-max').prop('checked', true);
                } else {
                    popup.find('.measure-box-max').prop('checked', false);
                }
                if ((calMask & 16) > 0) {
                    popup.find('.measure-box-min').prop('checked', true);
                } else {
                    popup.find('.measure-box-min').prop('checked', false);
                }
                if ((calMask & 64) > 0) {
                    popup.find('.measure-box-avg').prop('checked', true);
                } else {
                    popup.find('.measure-box-avg').prop('checked', false);
                }
                if ((calMask & 8) > 0 || (calMask & 32) > 0) {
                    popup.find('.measure-box-markers').prop('checked', true);
                } else {
                    popup.find('.measure-box-markers').prop('checked', false);
                }
                if ((calMask & 1024) > 0) {
                    popup.find('.measure-box-iso').prop('checked', true);
                } else {
                    popup.find('.measure-box-iso').prop('checked', false);
                }
            }
        });
    }

    function synchPopupFromDiff(popup) {
        var mfunc = popup.prop('id');
        if (typeof mfunc === 'undefined')
            return;
        mfunc = mfunc.split('-');
        var type = mfunc[0];
        var id = mfunc[1];
        getMeasure(type, id, function (measureData) {
            if (measureData.active == 'true') {
                var sel1 = popup.children('.diff-term-1');
                var sel2 = popup.children('.diff-term-2');
                var reftemp1 = replaceDiffOptions(sel1, measureData.type0, measureData.id0, measureData.res0);
                var reftemp2 = replaceDiffOptions(sel2, measureData.type1, measureData.id1, measureData.res1);
                if (reftemp1 || reftemp2) {
                    $('.diff-reftemp').removeAttr('disabled');
                } else {
                    $('.diff-reftemp').attr('disabled', 'disabled');
                }
            } else {
                // No diff is active. That means activation failed due to invalid setup. Setup to fail save.
                $('.diff-reftemp').removeAttr('disabled');
                setResource('.image.sysimg.measureFuncs.diff.' + id + '.type0', 'reftemp');
                setResource('.image.sysimg.measureFuncs.diff.' + id + '.res0', 'value');
                setResource('.image.sysimg.measureFuncs.diff.' + id + '.id0', '1');
                setResource('.image.sysimg.measureFuncs.diff.' + id + '.type1', 'reftemp');
                setResource('.image.sysimg.measureFuncs.diff.' + id + '.res1', 'value');
                setResource('.image.sysimg.measureFuncs.diff.' + id + '.id1', '1');
                setResource('.image.sysimg.measureFuncs.diff.' + id + '.active', true);
            }
        });

        // There is only one reference temperature, regardless how many deltas we have

        getResource('.image.sysimg.measureFuncs.reftemp.1.valueT', function (result) {
            $('.diff-reftemp').val(kelvinToCurrentTemperatureUnit(result, true));
        });
    }

    function replaceDiffOptions(list, selType, selId, selRes) {
        // Remove old options
        var options = list.children();
        $.each(options, function (index) {
            $(this).remove();
        });

        // Add active mfuncs (spots and boxes only (?))
        var table = document.getElementsByClassName('sidebar-content measurements');
        var items = $(table).children();
        $.each(items, function (index) {
            var child = null;
            var sid = $(this).prop('id');
            if (sid === '') {
                return;
            }
            if (typeof sid === 'undefined') {
                return;
            }
            sid = sid.split('-bar-');
            var type = sid[0];
            var id = sid[1];
            if (type === 'spot') {
                addDiffOption(list, 'Spot ' + id, type, id, 'value', (type == selType && id == selId) ? true : false);
            } else if (type === 'mbox') {
                child = $(this).children('.temp-max');
                if (child !== null && typeof child !== 'undefined' && child.is(':visible')) {
                    addDiffOption(list, 'Box max ' + id, type, id, 'max', type == selType && id == selId && selRes == 'max');
                }
                child = $(this).children('.temp-min');
                if (child !== null && typeof child !== 'undefined' && child.is(':visible')) {
                    addDiffOption(list, 'Box min ' + id, type, id, 'min', type == selType && id == selId && selRes == 'min');
                }
                child = $(this).children('.temp-average');
                if (child !== null && typeof child !== 'undefined' && child.is(':visible')) {
                    addDiffOption(list, 'Box avg ' + id, type, id, 'avg', type == selType && id == selId && selRes == 'avg');
                }
            }
        });

        // Add ref temp
        var reftemp = false;
        if (selType == 'reftemp' && selId == '1') {
            addDiffOption(list, 'Temp', 'reftemp', '1', 'value', true);
            reftemp = true;
        } else {
            addDiffOption(list, 'Temp', 'reftemp', '1', 'value', false);
            reftemp = false;
        }
        return reftemp;
    }

    function addDiffOption(list, label, type, id, res, selected) {
        if (selected) {
            $('<option selected id=' + type + '-' + res + '-' + id + '>' + label + '</option>').appendTo(list);
        } else {
            $('<option id=' + type + '-' + res + '-' + id + '>' + label + '</option>').appendTo(list);
        }
    }

    $(document.body).on('change', '.diff-term-1', function () {
        var popup = $(this).parents('.popup-diff');
        var mfunc = popup.prop('id').split('-');
        var selOption = $(this).find(':selected').prop('id').split('-');
        setResource('.image.sysimg.measureFuncs.' + mfunc[0] + '.' + mfunc[1] + '.type0', selOption[0]);
        setResource('.image.sysimg.measureFuncs.' + mfunc[0] + '.' + mfunc[1] + '.res0', selOption[1]);
        setResource('.image.sysimg.measureFuncs.' + mfunc[0] + '.' + mfunc[1] + '.id0', selOption[2]);

        // Enable reftemp value
        var sel1RefTemp = selOption[0] == 'reftemp' ? true : false;
        var sel2 = popup.children('.diff-term-2');
        var sel2RefTemp = sel2.find(':selected').prop('id').split('-');
        sel2RefTemp = sel2RefTemp[0] == 'reftemp' ? true : false;
        if (sel1RefTemp || sel2RefTemp)
            $('.diff-reftemp').removeAttr('disabled');
        else
            $('.diff-reftemp').attr('disabled', 'disabled');
    });

    $(document.body).on('change', '.diff-term-2', function () {
        var popup = $(this).parents('.popup-diff');
        var mfunc = popup.prop('id').split('-');
        var selOption = $(this).find(':selected').prop('id').split('-');
        setResource('.image.sysimg.measureFuncs.' + mfunc[0] + '.' + mfunc[1] + '.type1', selOption[0]);
        setResource('.image.sysimg.measureFuncs.' + mfunc[0] + '.' + mfunc[1] + '.res1', selOption[1]);
        setResource('.image.sysimg.measureFuncs.' + mfunc[0] + '.' + mfunc[1] + '.id1', selOption[2]);

        // Enable reftemp value
        var sel1 = popup.children('.diff-term-1');
        var sel1RefTemp = sel1.find(':selected').prop('id').split('-');
        sel1RefTemp = sel1RefTemp[0] == 'reftemp' ? true : false;
        var sel2RefTemp = selOption[0] == 'reftemp' ? true : false;
        if (sel1RefTemp || sel2RefTemp) {
            $('.diff-reftemp').removeAttr('disabled');
        } else {
            $('.diff-reftemp').attr('disabled', 'disabled');
        }
    });

    $(document.body).on('change', '.diff-reftemp', function () {
        var popup = $(this).parents('.popup-diff');
        var mfunc = popup.prop('id').split('-');
        setResource('.image.sysimg.measureFuncs.reftemp.' + mfunc[1] + '.refT', currentTemperatureUnitToKelvin($(this).val(), false));
    });

    $(document.body).on('change', '.local-active', function () {
        var popup = $(this).parents('.popup-local');
        var mfunc = popup.prop('id');
        mfunc = mfunc.split('-');
        var type = mfunc[0];
        var id = mfunc[1];
        var index = $(this).find(':selected').index();

        getResource('.image.sysimg.measureFuncs.' + type + '.' + id + '.parMask', function (result) {
            if (index == 0)
                result = result | 7;
            else
                result = result & ~7;
            setResource('.image.sysimg.measureFuncs.' + type + '.' + id + '.parMask', result);

            if (index == 0)
            {
                // Set reasonable defaults (take values from global parameters)
                if (popup.find('.local-emissivity').val() == 0) {
                    getResource('.image.sysimg.basicImgData.objectParams.emissivity', function (result) {
                        popup.find('.local-emissivity').val(parseFloat(result).toFixed(2));
                        setResource('.image.sysimg.measureFuncs.' + type + '.' + id + '.emissivity', result, function () {});
                    });
                }
                if (currentTemperatureUnitToKelvin(popup.find('.local-reftemp').val()) < 1) {
                    getResource('.image.sysimg.basicImgData.objectParams.ambTemp', function (result) {
                        popup.find('.local-reftemp').val(kelvinToCurrentTemperatureUnit(result));
                        setResource('.image.sysimg.measureFuncs.' + type + '.' + id + '.ambTemp', result, function () {});
                    });
                }
                if (popup.find('.local-distance').val() == 0) {
                    getResource('.image.sysimg.basicImgData.objectParams.objectDistance', function (result) {
                        popup.find('.local-distance').val(meterToCurrentDistanceUnit(result));
                        setResource('.image.sysimg.measureFuncs.' + type + '.' + id + '.objectDistance', result, function () {});
                    });
                }
                $('.local-emissivity').removeAttr('disabled');
                $('.local-reftemp').removeAttr('disabled');
                $('.local-distance').removeAttr('disabled');
            } else {
                $('.local-emissivity').attr('disabled', 'disabled');
                $('.local-reftemp').attr('disabled', 'disabled');
                $('.local-distance').attr('disabled', 'disabled');
            }
        });
    });

    $(document.body).on('change', '.local-emissivity', function () {
        var val = parseFloat($(this).val());
        var popup = $(this).parents('.popup-local');
        var mfunc = popup.prop('id').split('-');
        if (verifyEmissivity(val)) {
            setResource('.image.sysimg.measureFuncs.' + mfunc[0] + '.' + mfunc[1] + '.emissivity', val, function (result) {});
        } else {
            getResource('.image.sysimg.measureFuncs.' + mfunc[0] + '.' + mfunc[1] + '.emissivity', function (result) {
                popup.find('.local-emissivity').val(parseFloat(result).toFixed(2));
            });
        }
    });

    $(document.body).on('change', '.local-reftemp', function () {
        var val = parseFloat($(this).val());
        var popup = $(this).parents('.popup-local');
        var mfunc = popup.prop('id').split('-');
        if (verifyReflectedTemp(val)) {
            setResource('.image.sysimg.measureFuncs.' + mfunc[0] + '.' + mfunc[1] + '.ambTemp', currentTemperatureUnitToKelvin($(this).val()), function (result) {});
        } else {
            getResource('.image.sysimg.measureFuncs.' + mfunc[0] + '.' + mfunc[1] + '.ambTemp', function (result) {
                popup.find('.local-reftemp').val(kelvinToCurrentTemperatureUnit(result));
            });
        }
    });

    $(document.body).on('change', '.local-distance', function () {
        var val = parseFloat($(this).val());
        var popup = $(this).parents('.popup-local');
        var mfunc = popup.prop('id').split('-');
        if (verifyDistance(val))
        {
            setResource('.image.sysimg.measureFuncs.' + mfunc[0] + '.' + mfunc[1] + '.objectDistance', currentDistanceUnitToMeter($(this).val()), function (result) {});
        }
        else {
            getResource('.image.sysimg.measureFuncs.' + mfunc[0] + '.' + mfunc[1] + '.objectDistance', function (result) {
                popup.find('.local-distance').val(meterToCurrentDistanceUnit(result));
            });
        }
    });

    $(document.body).on('click', '.button-local-reset', function (e) {
        resetLocalParameters($(this).parents('.popup-local'));
    });

    /**
     * @param popup window
     */
    function resetLocalParameters(popup) {
        var mfunc = popup.prop('id');
        mfunc = mfunc.split('-');
        var type = mfunc[0];
        var id = mfunc[1];
        getResource('.image.sysimg.basicImgData.objectParams.emissivity', function (result) {
            popup.find('.local-emissivity').val(parseFloat(result).toFixed(2));
            setResource('.image.sysimg.measureFuncs.' + type + '.' + id + '.emissivity', result, function () {});
        });
        getResource('.image.sysimg.basicImgData.objectParams.ambTemp', function (result) {
            popup.find('.local-reftemp').val(kelvinToCurrentTemperatureUnit(result));
            setResource('.image.sysimg.measureFuncs.' + type + '.' + id + '.ambTemp', result, function () {});
        });
        getResource('.image.sysimg.basicImgData.objectParams.objectDistance', function (result) {
            popup.find('.local-distance').val(meterToCurrentDistanceUnit(result));
            setResource('.image.sysimg.measureFuncs.' + type + '.' + id + '.objectDistance', result, function () {});
        });
    }

    $(document.body).on('click', '.measure-box-max', function (e) {
        var dis = $(this);
        var popup = $(this).parents('.popup-local');
        var mfunc = popup.prop('id');
        mfunc = mfunc.split('-');
        var type = mfunc[0];
        var id = mfunc[1];
        getResource('.image.sysimg.measureFuncs.' + type + '.' + id + '.calcMask', function (result) {
            if (dis.prop('checked') == true) {
                if (popup.find('.measure-box-markers').prop('checked') == true) {
                    result = result | 4 | 8;
                } else {
                    result = result | 4;
                }
            } else {
                result = result & ~4 & ~8;
            }
            setResource('.image.sysimg.measureFuncs.' + type + '.' + id + '.calcMask', result);
        });
    });

    $(document.body).on('click', '.measure-box-min', function (e) {
        var dis = $(this);
        var popup = $(this).parents('.popup-local');
        var mfunc = popup.prop('id');
        mfunc = mfunc.split('-');
        var type = mfunc[0];
        var id = mfunc[1];
        getResource('.image.sysimg.measureFuncs.' + type + '.' + id + '.calcMask', function (result) {
            if (dis.prop('checked')) {
                if (popup.find('.measure-box-markers').prop('checked')) {
                    result = result | 16 | 32;
                } else {
                    result = result | 16;
                }
            } else {
                result = result & ~16 & ~32;
            }
            setResource('.image.sysimg.measureFuncs.' + type + '.' + id + '.calcMask', result);
        });
    });

    $(document.body).on('click', '.measure-box-avg', function (e) {
        var dis = $(this);
        var popup = $(this).parents('.popup-local');
        var mfunc = popup.prop('id');
        mfunc = mfunc.split('-');
        var type = mfunc[0];
        var id = mfunc[1];
        getResource('.image.sysimg.measureFuncs.' + type + '.' + id + '.calcMask', function (result) {
            if (dis.prop('checked') == true)
                result = result | 64;
            else
                result = result & ~64;
            setResource('.image.sysimg.measureFuncs.' + type + '.' + id + '.calcMask', result, function () {});
        });
    });

    $(document.body).on('click', '.measure-box-markers', function (e) {
        var dis = $(this);
        var popup = $(this).parents('.popup-local');
        var mfunc = popup.prop('id');
        mfunc = mfunc.split('-');
        var type = mfunc[0];
        var id = mfunc[1];
        getResource('.image.sysimg.measureFuncs.' + type + '.' + id + '.calcMask', function (result) {
            if (dis.prop('checked') == true) {
                result = result | 8 | 32;
            } else {
                result = result & ~8 & ~32;
            }
            setResource('.image.sysimg.measureFuncs.' + type + '.' + id + '.calcMask', result);
        });
    });

    $(document.body).on('click', '.measure-box-iso', function (e) {
        var dis = $(this);
        var popup = $(this).parents('.popup-local');
        var mfunc = popup.prop('id');
        mfunc = mfunc.split('-');
        var type = mfunc[0];
        var id = mfunc[1];
        getResource('.image.sysimg.measureFuncs.' + type + '.' + id + '.calcMask', function (result) {
            if (dis.prop('checked') == true)
                result = result | 1024;
            else
                result = result & ~1024;
            setResource('.image.sysimg.measureFuncs.' + type + '.' + id + '.calcMask', result);
        });
    });

    $('.global-emissivity').change(function () {
        var val = parseFloat($(this).val());
        if (verifyEmissivity(val))
        {
            setResource('.image.sysimg.basicImgData.objectParams.emissivity', val, function (result) {
                if (result != 0) {
                    alert('Failed to set emissivity.');
                    updateGlobalParameters();   // Restore original value
                }
            });
        }
        else
            updateGlobalParameters();   // Restore original value
    });

    $('.global-ambient-temp').change(function () {
        var val = parseFloat($(this).val());
        if (verifyReflectedTemp(val)) {
            val = currentTemperatureUnitToKelvin(val.toString(), false);
            setResource('.image.sysimg.basicImgData.objectParams.ambTemp', val, function (result) {
                if (result != 0) {
                    alert('Failed to set reflected temperature.');
                    updateGlobalParameters();   // Restore original value
                }
            });
        } else {
            updateGlobalParameters();   // Restore original value
        }
    });

    $('.global-distance').change(function () {
        var val = parseFloat($(this).val());
        if (verifyDistance(val)) {
            val = currentDistanceUnitToMeter(val.toString(), 3);
            setResource('.image.sysimg.basicImgData.objectParams.objectDistance', val, function (result) {
                if (result != 0) {
                    alert('Failed to set distance.');
                    updateGlobalParameters();   // Restore original value
                }
            });
        } else {
            updateGlobalParameters();   // Restore original value
        }
    });

    function verifyEmissivity(val) {
        if (isNaN(val)) {
            alert('Incorrect value: Should be a numerical value between 0.01 and 1.00.');
            return false;
        } else if (val > 1 || val < 0.01) {
            alert('Incorrect value: Should be a value between 0.01 and 1.00.');
            return false;
        }
        return true;
    }

    function verifyReflectedTemp(val) {
        if (isNaN(val)) {
            alert('Incorrect value: Should be a numerical value.');
            return false;
        }
        else {
            val = currentTemperatureUnitToKelvin(val.toString(), false);
            if (val < 0) {
                alert('Incorrect value: Should be above absolute zero.');
                return false;
            } else if (val > 2273) {
                alert('Incorrect value: Should be less than ' + Math.round(kelvinToCurrentTemperatureUnit('2273', false)) + '.');
                return false;
            }
        }
        return true;
    }

    function verifyDistance(val) {
        if (isNaN(val)) {
            alert('Incorrect value: Should be a numerical value.');
            return false;
        }
        val = currentDistanceUnitToMeter(val.toString(), 3);
        if (val < 0.20) {
            if ($.cookie('distanceUnit') === 'metric') {
                alert('Incorrect value: Should be above 0.2.');
            } else {
                alert('Incorrect value: Should be above ' + meterToFeet('0.2', 2) + '.');
            }
            return false;
        }
        return true;
    }

    $('.global-relative-humidity').change(function () {
        var val = parseFloat($(this).val());
        if (isNaN(val)) {
            alert('Incorrect value: Should be a numerical value.');
            updateGlobalParameters();   // Restore original value
        } else {
            if (val < 1 || val > 100) {
                alert('Incorrect value: Should be between 1 and 100');
                updateGlobalParameters();   // Restore original value
            } else {
                setResource('.image.sysimg.basicImgData.objectParams.relHum', val / 100, function (result) {
                    if (result != 0) {
                        alert('Failed to set relative humidity.');
                        updateGlobalParameters();   // Restore original value
                    }
                });
            }
        }
    });

    $('.global-atmospheric-temp').change(function () {
        var val = parseFloat($(this).val());
        if (isNaN(val)) {
            alert('Incorrect value: Should be a numerical value.');
            updateGlobalParameters();   // Restore original value
        } else {
            val = currentTemperatureUnitToKelvin(val.toString(), false);
            if (val < 0) {
                alert('Incorrect value: Should be above absolute zero.');
                updateGlobalParameters();   // Restore original value
            } else if (val > 2273) {
                alert('Incorrect value: Should be less than ' + Math.round(kelvinToCurrentTemperatureUnit('2273', false)) + '.');
                updateGlobalParameters();   // Restore original value
            } else {
                setResource('.image.sysimg.basicImgData.objectParams.atmTemp', val, function (result) {
                    if (result != 0) {
                        alert('Failed to set reflected temperature.');
                        updateGlobalParameters();   // Restore original value
                    }
                });
            }
        }
    });

    $('.global-external-window-active').change(function () {
        if ($(this).val() === 'On') {
            setResource('.image.sysimg.basicImgData.objectParams.extOptTransmAltActive', 'true', function () {
                updateGlobalParameters();   // Update state of ext opt params
            });
        } else {
            setResource('.image.sysimg.basicImgData.objectParams.extOptTransmAltActive', 'false', function () {
                updateGlobalParameters();   // Update state of ext opt params
            });
        }
    });

    $('.global-external-window-temp').change(function () {
        var val = parseFloat($(this).val());
        if (isNaN(val)) {
            alert('Incorrect value: Should be a numerical value.');
            updateGlobalParameters();   // Restore original value
        } else {
            val = currentTemperatureUnitToKelvin(val.toString(), false);
            if (val < 0) {
                alert('Incorrect value: Should be above absolute zero.');
                updateGlobalParameters();   // Restore original value
            } else if (val > 2273) {
                alert('Incorrect value: Should be less than ' + Math.round(kelvinToCurrentTemperatureUnit('2273', false)) + '.');
                updateGlobalParameters();   // Restore original value
            } else {
                setResource('.image.sysimg.basicImgData.objectParams.extOptTemp', val, function (result) {
                    if (result != 0) {
                        alert('Failed to set external optics temperature.');
                        updateGlobalParameters();   // Restore original value
                    }
                });
            }
        }
    });

    $('.global-external-window-transmission').change(function () {
        var val = parseFloat($(this).val());
        if (isNaN(val)) {
            alert('Incorrect value: Should be a numerical value.');
            updateGlobalParameters();   // Restore original value
        } else {
            if (val < 1 || val > 100) {
                alert('Incorrect value: Should be between 1 and 100');
                updateGlobalParameters();   // Restore original value
            } else {
                setResource('.image.sysimg.basicImgData.objectParams.extOptTransmAltVal', val / 100, function (result) {
                    if (result != 0) {
                        alert('Failed to set external optics transmission.');
                        updateGlobalParameters();   // Restore original value
                    }
                });
            }
        }
    });

    $('.button-global-reset').on('click', function () {
        // Do this properly with default_params.rsc file in factory folder !!!
        setResource('.image.sysimg.basicImgData.objectParams.emissivity', 0.95);
        setResource('.image.sysimg.basicImgData.objectParams.ambTemp', 293.14);
        setResource('.image.sysimg.basicImgData.objectParams.relHum', 0.5);
        setResource('.image.sysimg.basicImgData.objectParams.atmTemp', 293.14);
        setResource('.image.sysimg.basicImgData.objectParams.objectDistance', 1);
        setResource('.image.sysimg.basicImgData.objectParams.extOptTransmAltActive', 'false');
        setResource('.image.sysimg.basicImgData.objectParams.extOptTemp', 293.14);
        setResource('.image.sysimg.basicImgData.objectParams.extOptTransmAltVal', 1);

        updateGlobalParameters();
    });

    $('#button-save-image').on('click', function () {
        setResource('.resmon.action.snapshot', 'true');
        showNotification('Saving...');
    });

    $('.select-palette').on('change', function () {
        var val = $(this).val();
        val = val.split('-iso-');
        var pal = val[0];
        var iso = val[1];

        // Set palette
        $.ajax({
            type: 'POST',
            url: 'palette.php',
            data: { palette: pal },
            dataType: 'json',
            success: function () {
                $('.scale').prop('id', pal);
            },
            error:function (xhr, status, e) {
                console.log(e);
            }
        });

        // Set isotherm
        if (typeof iso !== 'undefined' && iso != '') {
            setResource('.image.sysimg.measureFuncs.isotherm.1.type', iso);
            var color = 'yellow';
            if (iso === 'above') {
                color = 'red';
            } else if (iso === 'below') {
                color = 'blue';
            }
            setResource('.image.sysimg.measureFuncs.isotherm.1.color', color);
            setResource('.image.sysimg.measureFuncs.isotherm.1.active', true);
            $('.isotherm').css('display', 'inline-block');
            $('.isotherm').css('background-color', color);
            $('.isotherm').css('opacity', 0.6);
            isotherm = iso;
            $('.temp-global-max').data('value', '0');      // Just make sure this prop exists
            $('.temp-global-min').data('value', '0');

            if (isotherm === 'above') {
                $('#iso-value-low').val(kelvinToCurrentTemperatureUnit(isothermHighT, false));
                $('#iso-value-high').val('Max');
                $('#iso-value-high').attr('disabled', 'disabled');
                $('#iso-value-low').removeAttr('disabled');
            } else if (isotherm === 'below') {
                $('#iso-value-high').val(kelvinToCurrentTemperatureUnit(isothermHighT, false));
                $('#iso-value-low').val('Min');
                $('#iso-value-high').removeAttr('disabled');
                $('#iso-value-low').attr('disabled', 'disabled');
            } else {
                $('#iso-value-high').val(kelvinToCurrentTemperatureUnit(isothermHighT, false));
                $('#iso-value-low').val(kelvinToCurrentTemperatureUnit(isothermLowT, false));
                $('#iso-value-high').removeAttr('disabled');
                $('#iso-value-low').removeAttr('disabled');
            }
            $('.isotherm-values').show();
        } else {
            setResource('.image.sysimg.measureFuncs.isotherm.1.active', false);
            $('.isotherm').css('display', 'none');
            isotherm = '';
            $('.isotherm-values').hide();
        }
    });

    $('#iso-value-high').on('change', function () {
        var val = parseFloat($(this).val());
        if (verifyIsothermValue(val)) {
            if (isotherm == 'below' || isotherm == 'interval') {
                setResource('.image.sysimg.measureFuncs.isotherm.1.highT', currentTemperatureUnitToKelvin($(this).val(), false));
            }
        } else {
            $('#iso-value-high').val(kelvinToCurrentTemperatureUnit(isothermHighT, false));
        }
    });

    $('#iso-value-low').on('change', function () {
        var val = parseFloat($(this).val());
        if (verifyIsothermValue(val) == true) {
            if (isotherm === 'above') {
                setResource('.image.sysimg.measureFuncs.isotherm.1.highT', currentTemperatureUnitToKelvin($(this).val(), false));
            } else if (isotherm === 'interval') {
                if (currentTemperatureUnitToKelvin($(this).val(), false) > isothermHighT) {
                    alert("Incorrect value: Should be less than 'To' value.");
                    $('#iso-value-low').val(kelvinToCurrentTemperatureUnit(isothermLowT, false));
                    return;
                }
                setResource('.image.sysimg.measureFuncs.isotherm.1.lowT', currentTemperatureUnitToKelvin($(this).val(), false));
            }
        } else if (isotherm == 'above') {
            $('#iso-value-low').val(kelvinToCurrentTemperatureUnit(isothermHighT, false));
        } else if (isotherm == 'interval') {
            $('#iso-value-low').val(kelvinToCurrentTemperatureUnit(isothermLowT, false));
        }
    });

    function verifyIsothermValue(val) {
        if (isNaN(val)) {
            alert('Incorrect value: Should be a numerical value.');
            return false;
        }
        val = currentTemperatureUnitToKelvin(val.toString(), false);
        if (val < 0) {
            alert('Incorrect value: Should be above absolute zero.');
            return false;
        }
        return true;
    }

    $(document).mouseup(function (e) {
        var container = $('.popup-alarm');
        if (!container.is(e.target) && container.has(e.target).length === 0) {
            container.hide();
            var buttons = container.parent('.button-alarm');    // container is all alarm popups, not just ours!
            for (var i = 0, l = buttons.length; i < l; i++) {
                var button = buttons[i];
                if (button && button !== undefined) {
                    if ($(button).hasClass('button-activated') == false) {
                        $(button).removeAttr('data-measfunc-alarm');
                    }
                }
            }
        }
        container = $('.popup-local');
        if (!container.is(e.target) && container.has(e.target).length === 0) {
            container.hide();
        }
        container = $('.popup-diff');
        if (!container.is(e.target) && container.has(e.target).length === 0) {
            container.hide();
        }
        var popups = $('.popup-hoverable');
        for (var i = 0, l = popups.length; i < l; i++) {
            var popup = popups[i];
            var par = $(popup).parent();
            if (popup && popup != undefined && !$(popup).is(e.target) && $(popup).has(e.target).length === 0 && !$(par).is(e.target)) {
                $(popup).hide();
            }
        }
    });

    $('.button-popup').on('click', function (e) {
        var child = $(this).children().children();
        if (child != undefined && !child.is(e.target) && child.has(e.target).length === 0) {
            var disp = child.prop('style').display;
            if (disp === 'none' || disp === '') {
                child.prop('style').display = 'block';
            } else {
                child.prop('style').display = 'none';
            }
        }
    });

    $('#save-preset').on('click', function () {
        // Check if template file exists
        $.post(getBaseUrl() + 'home/echoPresetTemplateExists')
            .fail(function () {
                console.log('Failed to check for preset template');
            })
            .done(function (data) {
                if (data == 1) {
                    // Generate preset file
                    $.post(getBaseUrl() + 'home/echoCreatePreset')
                        .fail(function () {
                            console.log('Error. Could not download preset file.');
                        })
                        .done(function (data) {
                            // Download the file
                            window.location = getBaseUrl() + 'home/download/preset/' + data;
                        });
                        // window.location = getBaseUrl() + "home/echoCreatePreset";
                } else {
                    console.log('Preset template missing');
                }
            });
    });

    $('#load-preset').on('click', function () {
        // console.log("load-preset clicked");
        $('#preset-to-upload').click();
    });

    $('#preset-to-upload').on('click', function (e) {
        // console.log("preset-to-upload clicked");
        e.stopPropagation();
        $(this).val('');
    });

    $('#preset-to-upload').change(function () {
        var file_data = $(this).get(0).files[0];
        // console.log("file_data: " + file_data);
        if (file_data != '') {
            var form_data = new FormData();
            form_data.append('file', file_data);
            $.ajax({
                url: 'upload.php',
                contentType: false,
                processData: false,
                data: form_data,
                type: 'post',
                success: function (fileName) {
                    // Remove all existing subscriptions
                    // console.log("Removing subscriptions");
                    showNotification('Preparing preset...');
                    $.post(getBaseUrl() + 'home/removesubscriptions');

                    // console.log("upload.success: " + fileName);
                    // Extract preset tar
                    var mod_fileName = fileName.replace(' ', '[space]');
                    var jqPost = $.post(getBaseUrl() + 'home/extractPreset/' + mod_fileName)
                    .fail(function () {
                        console.log('Error. Could not download preset file.');
                    })
                    .done(function () {
                        // console.log("extractPreset.done");
                        // Import and load preset
                        $.post(getBaseUrl() + 'home/importLoadPreset')
                        .fail(function () {
                            // console.log("Error. Could not importLoad preset file.");
                            showNotification('Failed to apply preset');
                        })
                        .done(function () {
                            // console.log("importLoadPreset.done");
                        });
                    });
                },
                error: function (data) {
                    console.log('upload.error: ' + data);
                }
            });
        }
    });

    var resizetimeout;                                              // Filter changes not to choke
    $(window).resize(function (ev) {
        if (ev.target === window) {
            $('.spot, .mbox, .mbox-max, .mbox-min').hide();         // Hide mfuncs while resizing
            window.clearInterval(resizetimeout);
            resizetimeout = setTimeout(function () {
                recalculateScaling();
                var markers = $('.mbox-max, .mbox-min');            // Show mfuncs again
                $('.spot, .mbox').show();
                $.each(markers, function (index, id) {
                    if ($(this).attr('data-calcMaskActive') == 'true') {
                        $(this).show();                             // Show active markers again
                    }
                });
            }, 1000);
        }
    });

    $('#log-save').on('click', function () {
        // Get log file name
        $.post(getBaseUrl() + 'home/echoLogFileName')
            .fail(function () {
                console.log('Error. Could not get log file name.');
            })
            .done(function (data) {
                if (data !== '') {
                    // Download the file
                    window.location = getBaseUrl() + 'home/download/logfile/' + data;
                }
            });
    });

    $('#log-clear').on('click', function () {
        $.post(getBaseUrl() + 'home/clearLogContent/')
            .fail(function () {
                console.log('Error. Could not clear log.');
            })
            .done(function () {
                $('#log-container').html('');
            });
        // window.location = getBaseUrl() + "home/clearLogContent/";
    });

    $('.sidebar-title').on('click', function () {
        var p = $(this).children('#expand-indicator').children('#expand-p');
        if (p.prop('innerHTML') === '+') {
            p.prop('innerHTML', '-');
        } else {
            p.prop('innerHTML', '+');
        }
    });
}); // End jQuery
