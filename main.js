var config = {
    SERVER_HOST: "http://127.0.0.1:3000",
    ADMIN_PASS: "adminpass",
    REFRESH_DELAY: 5 * 1000
};
var orderAnimDuration = 1000;

$(function () {
    chart = new Highcharts.Chart({
        chart: {
            height: 500,
            renderTo: 'chart-container',
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
        yAxis: [
            {
                title: {
                    text: 'Player score',
                    margin: 80
                }
            },
            {
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
                    formatter: function () {
                        return this.value + ' %';
                    },
                    style: {
                        color: '#AA4643'
                    }
                },
                opposite: true
            }
        ],
        series: [
            {
                name: 'progress',
                color: '#AA4643',
                dashStyle: 'shortdot',
                data: [],
                yAxis: 1
            }
        ]
    });

    $('.title').click(function () {
        $(this).siblings('.block').toggle('slide');
        $(this).find('.arrow').toggleClass('collapsed');
    });

    $('#options input').blur(function () {
        config[$(this).data('config')] = $(this).val();
    });

    $('button[data-action="reset-graph"]').click(function () {
        while (chart.series.length > 0)
            chart.series[0].remove(true);
        $('#scores ul').empty();
        chart.addSeries({
            name: 'progress',
            color: '#AA4643',
            dashStyle: 'shortdot',
            data: [],
            yAxis: 1
        }, false);
        $.bootstrapGrowl('Graph reset', { type: 'success' });
    });

    $('#admin button').click(function () {
        $.ajax({
            url: config.SERVER_HOST + $(this).data('action'),
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify($(this).parent().siblings('input').val()),
            headers: {
                adminpass: config.ADMIN_PASS
            },
            success: function () {
                $.bootstrapGrowl('Admin change successful', { type: 'success' });
            },
            error: showErrorDialog
        });
    });
});

var mergedLogs = [],
    requestTimeout = null;

function requestData() {
    // Request scores
    $.ajax({
        url: config.SERVER_HOST + '/scores',
        success: function (scores) {
            orderAnimDuration = chart.series.length === 1 ? 0 : config.REFRESH_DELAY / (_(scores).size() * 1.2);

            var $ul = $('#scores ul');
            _(scores)
                .each(function (score, player) {
                    var serie = _(chart.series).findWhere({name: player});
                    if (serie == null) {
                        chart.addSeries({
                            name: player,
                            data: []
                        }, false);
                        serie = _(chart.series).findWhere({name: player});
                        var gravatar = "http://www.gravatar.com/avatar/" + CryptoJS.MD5(player) + "?s=60&d=retro";
                        var $scoreLi = $('<li data-player="' + player + '" data-score="' + score + '"><img src="' + gravatar + '"><span class="player">' + player + '</span><span class="score"></span></li>');
                        $('#scores ul').append($scoreLi);
                    }
                    if ($scoreLi === undefined) $scoreLi = $ul.find('[data-player="' + player + '"]');

                    serie.addPoint([new Date().getTime(), score], true);
                    $scoreLi.find('.score').text(score);
                    $scoreLi.data('score', score);
                });

            if (orderStackDelay === 0) smoothReorder($ul); // animations seulement si précédentes terminées
        },
        error: showErrorDialog
    });

    // Request game info
    $.ajax({
        url: config.SERVER_HOST + '/admin/game',
        headers: {
            adminpass: config.ADMIN_PASS
        },
        success: function (game) {
            var serie = _(chart.series).findWhere({name: 'progress'});
            serie.addPoint([new Date().getTime(), game.progress], true);

            if ($('#grid .arrow').hasClass('collapsed')) return;
            var html = '';
            _(game.grid).each(function (line) {
                html += '<tr>';
                _(line).each(function (square) {
                    html += '<td class="' + color_class_map[square.color] + (square.found ? ' found"' : '"') + '>' + square.color + ' ' + square.symbol + '</td>';
                });
                html += '</tr>';
            });
            $('#grid table').html(html);
        },
        error: showErrorDialog
    });

    // Request logs
    $.ajax({
        url: config.SERVER_HOST + '/admin/logs',
        headers: {
            adminpass: config.ADMIN_PASS
        },
        success: function (logs) {
            logs = logs.reverse();
            var newLogs = '';
            logs.every(function (log) {
                if (_(mergedLogs).findWhere(log)) return false;
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

    clearTimeout(requestTimeout);
    requestTimeout = setTimeout(requestData, config.REFRESH_DELAY);
}

var orderStackDelay = 0;
function smoothReorder($ul) {
    // Calculate permutations to reorder list
    $ul.children().each(function (index, li) {
        $(li).prevAll().each(function (index2, li2) {
            if ($(li).data('score') > $(li2).data('score')) {
                _.delay(function () {
                    smoothReorderItem($(li), $(li2));
                }, orderStackDelay * orderAnimDuration * 1.1);
                orderStackDelay++;
                return false;
            }
        });
    });
}

function smoothReorderItem($li, $otherLi) {
    var elemTop = $li.position().top
        , elemTargetTop = $otherLi.position().top
        , moveUp = elemTop - elemTargetTop
        , moveDown = $li.height()
        , $ul = $li.parent();

    $li.prevAll().each(function () {
        if ($(this).index() < $otherLi.index()) return;
        $(this).css('opacity', 0.5);
        $(this).animate({
            top: '+=' + moveDown,
            opacity: 1
        }, orderAnimDuration);
    });

    $li.animate({
        top: '-=' + moveUp
    }, orderAnimDuration, function () {
        if ($otherLi.index() == 0) $li.detach().prependTo($ul);
        else $otherLi.prev().after($li);
        $ul.children().attr('style', '');
        orderStackDelay--;
    });
}

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
