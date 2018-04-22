var paths = [];
var pathCount = 0;
var joinCount = 0;
var closePathCount = 0;
var isSkipPaths = [];
var connectDistanceSquare;
var isRemoveHandleData;
var isConnectMiddle;
var closePathCondition;
var unequalProperty;
var isReverseAngle;
var gapAllowRad;
var ANCHOR;
var POSITIVE;
var NEGATIVE;
var atan2 = Math.atan2;
var floor = Math.floor;
var pow = Math.pow;
var abs = Math.abs;
var PI = Math.PI;

function main() {
  var win;
  var winCloseFlg = false;
  var activeSelection;
  var activeBounds;
  var edgeAnchorCount = 0;
  var ANGLE_ABSORPTION = 0.001;  // 角度を比較する時に発生する計算誤差の許容量

  try {
    win = createGUI();
    if (!win) return;

    ANCHOR = PathPointSelection.ANCHORPOINT;
    POSITIVE = PolarityValues.POSITIVE;
    NEGATIVE = PolarityValues.NEGATIVE;

    activeSelection = activeDocument.selection;
    if (activeSelection.length === 0) {
      alert('パスが選択されていません');
      return;
    }
  }
  catch (e) {
    alert(e, 'Error', true);
    return;
  }

  win.buttonRun.onClick = function() {
    function updateWindow(str) {
      win.staticTextProgressInfo.text = str;
      win.update();
    }

    // オープンパスを探して配列に保存
    function iter2extractPaths(items) {
      for (var i = 0, len = items.length; i < len; i++)
        extractPaths(items[i]);
    }
    function extractPaths(pageItem) {
      switch (pageItem.typename) {
        case 'PathItem':
          if (!pageItem.hidden && !pageItem.locked && !pageItem.closed) {
            pathObj[pathCount] = pageItem;
            pathObj[pathCount].isAnchorStart = pageItem.pathPoints[0].selected === ANCHOR;
            pathObj[pathCount].isAnchorEnd = pageItem.pathPoints[pageItem.pathPoints.length - 1].selected === ANCHOR;
            if (pathObj[pathCount].isAnchorStart) edgeAnchorCount++;
            if (pathObj[pathCount].isAnchorEnd) edgeAnchorCount++;

            // [left, top, right, bottom] スクリプトでは下方向がマイナス
            var bounds = pageItem.geometricBounds;
            if (activeBounds[0] > bounds[0]) activeBounds[0] = bounds[0];
            if (activeBounds[1] < bounds[1]) activeBounds[1] = bounds[1];
            if (activeBounds[2] < bounds[2]) activeBounds[2] = bounds[2];
            if (activeBounds[3] > bounds[3]) activeBounds[3] = bounds[3];

            isSkipPaths[pathCount] = false;
            pathCount++;
          }
          break;
        case 'GroupItem':
          iter2extractPaths(pageItem.pathItems);
          iter2extractPaths(pageItem.groupItems);
          iter2extractPaths(pageItem.compoundPathItems);
          break;
        case 'CompoundPathItem':
          iter2extractPaths(pageItem.pathItems);
          break;
        default:
          throw new Error('[' + pageItem.typename + '] に対しては処理できません。');
      }
    }

    try {
      $.writeln('--- Run ---');
      var startTime = new Date().getTime();
      var settings = {};
      var RB_MERGE = {
        OTHER : 0,  // 他のパスとの連結
        CLOSE : 1,  // 同じパスの両端を連結
        BOTH  : 2,  // 両方
      };
      var RB_CONNECT = {
        MIDDLE : 0,  // 2点を中間位置に移動
        ADD    : 1,  // 2点を繋ぐ線を追加
      };
      win.enabled = false;

      //----------------------
      // 選択オブジェクトからオープンパスを取得
      if (paths.length === 0) {
        updateWindow('パス取得中…');
        activeBounds = activeSelection[0].geometricBounds;
        iter2extractPaths(activeSelection);

        if (edgeAnchorCount < 2) {
          alert('パスの端にあるアンカーポイントを２つ以上選択してください');
          return;
        }
        // 他のパスと連結する時は２つ以上パスを選択
        if (settings.rbMerge === RB_MERGE.OTHER) {
          if (pathCount < 2) {
            alert('パスを２つ以上選択してください');
            return;
          }
        }
        $.writeln('path:' + pathCount + ' edgeAnchor:' + edgeAnchorCount);
      }


      //----------------------
      // 入力内容の確認
      var reg = /^([1-9]\d*|0)(\.\d+)?$/;  // 0以上の数値のみ(小数可)
      for (var key in controls) {
        if (controls.hasOwnProperty(key)) {
          var set = controls[key];
          if (set.type === 'checkbox') {
            if (key[0] === '_') {
              // 配列に真だった値のキーを登録
              if (!settings[set.name])
                settings[set.name] = {};
              var obj = {value: set.value};
              if (set.equals) obj.equals = set.equals;
              settings[set.name][key.substring(1)] = obj;
            }
            else
              settings[key] = set.value;
          }
          else if (set.type === 'radiobutton') {
            // rbName_0 の数値を取り出し、アンダーバーより前をキーとして登録
            var match = key.match(/\d+?$/);
            var radioKey = key.substring(0, match.index - 1);
            var index = parseInt(match, 10);
            if (set.value)
              settings[radioKey] = index;
          }
          else if (set.type === 'edittext') {
            if (reg.test(set.text))
              settings[key] = parseFloat(set.text, 10);
            else {
              var title = defaultSettings.hasOwnProperty(key) ? defaultSettings[key].title : advanceSettings[key].title;
              throw new Error('0以上の数値を入力してください: [' + title + ']');
            }
          }
        }
      }
      // $.writeln(settings.toSource());

      //----------------------
      // 設定変換

      // アンカーの距離が指定値より近いか計算する用
      connectDistanceSquare = settings.connectDistance * settings.connectDistance;
      // ハンドルデータを保持するかどうか
      isRemoveHandleData = !settings.keepHandleData;

      // 中間位置で連結する時は4つ、間に線を追加する時はアンカーポイントが3つ以上なければ連結しない
      isConnectMiddle = settings.rbConnect === RB_CONNECT.MIDDLE;
      closePathCondition = isConnectMiddle ? 4 : 3;

      // 指定したプロパティの比較
      unequalProperty = (function() {
        var attr = settings.attr;
        var func = '(function(){return function(a,b){';
        for (var key in attr) {
          if (attr[key].value) {
            if (attr[key].equals)
              func += 'if(!' + attr[key].equals + '(a.' + key + ',' + 'b.' + key + '))return 1;';
            else
              func += 'if(a.' + key + '!==b.' + key + ')return 1;';
          }
        }
        func += 'return 0;}})()';
        return eval(func);
      }());

      // 角度計算許容量
      gapAllowRad = conv2radian(settings.gapAllowDeg + ANGLE_ABSORPTION);
      // 角度比較をどの軸で行うか
      isReverseAngle = (function() {
        var a = settings.vertical ? 0x01 : 0;
        var b = settings.horizontal ? 0x10 : 0;
        switch (a | b) {
          case 0x11:
            return function(pos1, pos2, pos3, pos4) {
              return isReverseAngleHorizontalVertical(getAngle(pos1, pos2), getAngle(pos3, pos4));
            };
          case 0x10:
            return function(pos1, pos2, pos3, pos4) {
              return isReverseAngleHorizontal(getAngle(pos1, pos2), getAngle(pos3, pos4));
            };
          case 0x01:
            return function(pos1, pos2, pos3, pos4) {
              return isReverseAngleVertical(getAngle(pos1, pos2), getAngle(pos3, pos4));
            };
          default:
            return false;
        }
      }());

      //----------------------
      // 他のパスとの連結処理
      if (settings.rbMerge !== RB_MERGE.CLOSE) {
        updateWindow('4分木登録中…');
        var level = 0;
        if (pathCount > 20)
          level = floor(pathCount / 800) + 3;  // 適当
        LinearQuadtreePartition.init(activeBounds, level, settings.connectDistance);
        LinearQuadtreePartition.regist(paths);
        updateWindow('他のパスとの連結中…');
        LinearQuadtreePartition.start();
      }

      //----------------------
      // パスのクローズ処理
      if (settings.rbMerge !== RB_MERGE.OTHER) {
        updateWindow('同じパスの両端を連結中…');
        for (var i = 0; i < pathCount; i++) {
          if (isSkipPaths[i])
            continue;
          mightClosePath(paths[i]);
        }
      }

      //----------------------
      // 一つでも連結できていればスクリプトを終了させる
      if (joinCount !== 0 || closePathCount !== 0)
        winCloseFlg = true;

      //----------------------
      // 結果を表示
      updateWindow('完了');
      var resultTime = new Date().getTime() - startTime;
      var messageLeft = [
        '連結数',
        'クローズ数',
        '対象オープンパス数',
        '処理時間(ms)',
      ].join('\n');
      var messageRight = [
        joinCount,
        closePathCount,
        pathCount,
        resultTime,
      ].join('\n');

      var winResult = new Window('dialog', 'Result');
      var messageGroup = winResult.add('group');
      messageGroup.spacing = 6;
      messageGroup.add('statictext', undefined, messageLeft, {multiline: true});
      messageGroup.add('statictext', undefined, ':\n:\n:\n:', {multiline: true});
      messageGroup.add('statictext', undefined, messageRight, {multiline: true});
      winResult.buttonOK = winResult.add('button', [0, 0, 142, 28], 'OK');
      winResult.buttonOK.onClick = function() {
        winResult.close();
      };
      winResult.center(win);
      winResult.show();
    }
    catch (e) {
      alert(e, 'Error', true);
    }
    finally {
      if (winCloseFlg) {
        win.close();
        $.writeln('---- End script ----');
      }
      else {
        updateWindow('連結できませんでした');
        win.enabled = true;
      }
    }
  };

  win.center();
  win.show();
}

$.writeln('\n---- Start script ----');
main();
