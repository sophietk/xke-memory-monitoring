var SERVER_HOST = "http://127.0.0.1:3000",
    ADMIN_PASS = "adminpass",
    REFRESH_DELAY = 5 * 1000;

$(function() {
    chart = new Highcharts.Chart({
        chart: {
            renderTo: 'container',
            defaultSeriesType: 'spline',
            events: {
                load: requestData
            }
        },
        plotOptions: {
            series: {
                marker: {
                    fillColor: 'none',
                    lineColor: null
                }
            }
        },
        title: {
            text: 'Total scores'
        },
        xAxis: {
            type: 'datetime',
            tickPixelInterval: 150,
            maxZoom: 20 * 1000
        },
        yAxis: [{
            title: {
                text: 'Player score',
                margin: 80
            }
        }, {
            min: 0,
            max: 100,
            minPadding: 0,
            maxPadding: 0,
            title: {
                text: 'Current game progress',
                margin: 80,
                style: {
                    color: '#AA4643'
                }
            },
            labels: {
                formatter: function() {
                    return this.value + ' %';
                },
                style: {
                    color: '#AA4643'
                }
            },
            opposite: true
        }],
        series: [{
            name: 'progress',
            color: '#AA4643',
            dashStyle: 'shortdot',
            data: [],
            yAxis: 1
        }]
    });

    $('input[name="server-host"]').blur(function() {
        SERVER_HOST = $(this).val();
    });

    $('input[name="admin-pass"]').blur(function() {
        ADMIN_PASS = $(this).val();
    });

    $('input[name="refresh-delay"]').blur(function() {
        REFRESH_DELAY = $(this).val();
    });

    $('#options .title').click(function() {
        $('#options .block').toggle('slide');
        $('#options .arrow').toggleClass('collapsed');
    });

    $('button[data-action="new"]').click(function() {
        $.ajax({
            url: SERVER_HOST + '/admin/new',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify($('.game-size').val()),
            headers: {
                adminpass: ADMIN_PASS
            },
            success: function() {
                $.bootstrapGrowl('New game started', { type: 'success' });
            },
            error: showErrorDialog
        });
    });

    $('button[data-action="change-tempo"]').click(function() {
        $.ajax({
            url: SERVER_HOST + '/admin/tempo',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify($('.turn-tempo').val()),
            headers: {
                adminpass: ADMIN_PASS
            },
            success: function() {
                $.bootstrapGrowl('Change turn temporizing successfully', { type: 'success' });
            },
            error: showErrorDialog
        });
    });

    $('button[data-action="reset-scores"]').click(function() {
        $.ajax({
            url: SERVER_HOST + '/admin/reset',
            type: 'POST',
            headers: {
                adminpass: ADMIN_PASS
            },
            success: function() {
                $.bootstrapGrowl('Scores and games reset successfully', { type: 'success' });
            },
            error: showErrorDialog
        });
    });

    $('button[data-action="reset-graph"]').click(function() {
        while(chart.series.length > 0)
            chart.series[0].remove(true);
        chart.addSeries({
            name: 'progress',
            color: '#AA4643',
            dashStyle: 'shortdot',
            data: [],
            yAxis: 1
        }, false);
        $.bootstrapGrowl('Graph reset', { type: 'success' });
    });

    $('#logs .title').click(function() {
        $('#logs .block').toggle('slide');
        $('#logs .arrow').toggleClass('collapsed');
    });

    $('#grid .title').click(function() {
        $('#grid .block').toggle('slide');
        $('#grid .arrow').toggleClass('collapsed');
    });
});

function requestData() {
    $.ajax({
        url: SERVER_HOST + '/scores',
        success: function(scores) {
            _.each(scores, function(score, player) {
                var serie = _.findWhere(chart.series, {name: player});
                if (serie == null) {
                    chart.addSeries({
                        name: player,
                        data: []
                    }, false);
                    serie = _.findWhere(chart.series, {name: player});
                }
                serie.addPoint([new Date().getTime(), score], true);
            });

            setTimeout(requestData, REFRESH_DELAY);
        },
        error: function() {
            setTimeout(requestData, REFRESH_DELAY);
        }
    });

    $.ajax({
        url: SERVER_HOST + '/admin/game',
        headers: {
            adminpass: ADMIN_PASS
        },
        success: function(game) {
            var serie = _.findWhere(chart.series, {name: 'progress'});
            serie.addPoint([new Date().getTime(), game.progress], true);
            if (!$('#grid .arrow').hasClass('collapsed')) {
                var html = '';
                _.each(game.grid, function(line) {
                    html += '<tr>';
                    _.each(line, function(square) {
                        html += '<td class="' + color_class_map[square.color] + (square.found ? ' found"' : '"') + '>' + square.color + ' ' + square.symbol + '</td>';
                    });
                    html += '</tr>';
                });
                $('#grid table').html(html);
            }
        },
        error: showErrorDialog
    });
}

var mergedLogs = [];
function refreshLogs() {
    $.ajax({
        url: SERVER_HOST + '/admin/logs',
        headers: {
            adminpass: ADMIN_PASS
        },
        success: function(logs) {
            logs = logs.reverse();
            var newLogs = '';
            logs.every(function(log) {
                if (_.findWhere(mergedLogs, log)) return false;
                mergedLogs.push(log);
                newLogs = moment(log.date).format('HH:mm:ss') + ' - ' + log.player + ' - ' + log.action + '\n' + newLogs;
                return true;
            });
            var $logs = $('#logs textarea');
            $logs
                .append(newLogs)
                .animate({
                    scrollTop: $logs[0].scrollHeight - $logs.height()
                });
        },
        error: showErrorDialog
    });
    setTimeout(refreshLogs, REFRESH_DELAY);
}
refreshLogs();

function showErrorDialog(data) {
    if (data.responseText) $.bootstrapGrowl(data.responseText, { type: 'danger' });
    else console.log('Erreur inconnue', data);
}

var color_class_map = {
    'red': 'alert-danger',
    'blue': 'alert-info',
    'yellow': 'alert-warning',
    'green': 'alert-success'
};
