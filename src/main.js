function selfTalk(func, args, callback) {
  var bt = new BridgeTalk();
  bt.target = SCRIPT_TARGET;
  bt.body = '(' + func + ')(' + args.toSource() + ')';
  bt.onResult = function(res) {
    if (callback) callback(res.body);
  };
  bt.send();
}

function main() {
  var runCount = 0;
  var win = createGUI();
  if (!win) return;

  win.buttonRun.onClick = function() {
    $.writeln('--- Run ---');
    var sendSettings = {};

    //----------------------
    // 入力内容の確認
    try {
      var reg = /^([1-9]\d*|0)(\.\d+)?$/;  // 0以上の数値のみ(小数可)
      for (var key in controls) {
        if (controls.hasOwnProperty(key)) {
          var set = controls[key];
          if (set.type === 'checkbox') {
            if (key[0] === '_') {
              // 配列に真だった値のキーを登録
              if (!sendSettings[set.name])
                sendSettings[set.name] = {};
              var obj = {value: set.value};
              if (set.equals) obj.equals = set.equals;
              sendSettings[set.name][key.substring(1)] = obj;
            }
            else
              sendSettings[key] = set.value;
          }
          else if (set.type === 'radiobutton') {
            // rbName_0 の数値を取り出し、アンダーバーより前をキーとして登録
            var match = key.match(/\d+?$/);
            var radioKey = key.substring(0, match.index - 1);
            var index = parseInt(match, 10);
            if (set.value)
              sendSettings[radioKey] = index;
          }
          else if (set.type === 'edittext') {
            if (reg.test(set.text))
              sendSettings[key] = parseFloat(set.text, 10);
            else {
              var title = settings.hasOwnProperty(key) ? settings[key].title : advanceSettings[key].title;
              throw new Error('0以上の数値を入力してください: [' + title + ']');
            }
          }
        }
      }
      // $.writeln(sendSettings.toSource());
    }
    catch (e) {
      alert(e, 'Error', true);
      return;
    }

    var startTime = new Date().getTime();
    win.enabled = false;
    selfTalk(bridge, sendSettings, function(body) {
      try {
        $.writeln('-- callback --');
        $.writeln(body);
        var result = eval(body);
        if (!result) return;
        var resultTime = Math.round((new Date().getTime() - startTime) * 0.1) * 0.01;
        var message = '[' + (runCount + 1) + '] ' +
          result.joinCount +
          ' (' + result.closePathCount + ')' +
          ' / ' + result.pathCount +
          '  ' + resultTime + 's';
        $.writeln(message);
        win.listboxResult.add('item', message);
        win.listboxResult.selection = runCount;
        runCount++;
      }
      catch (e) {
        alert(e, 'Error', true);
      }
      finally {
        win.enabled = true;
        $.gc();
        $.gc();
        $.writeln('--- End ---');
      }
    });
  };

  win.center();
  win.show();
}

$.writeln('\n---- Start script ----');
$.writeln($.summary());
main();
