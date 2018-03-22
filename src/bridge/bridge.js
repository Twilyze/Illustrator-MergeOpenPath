  $.writeln('-- BridgeTalk() --');
  //----------------------
  // BridgeTalk()
  var winProgress;
  var pathObj = [];
  var pathCount = 0;
  var result = {};
  var skipPathArr = [];
  var skipPathCount = 0;
  var edgeAnchorCount = 0;
  var settings;
  var connectDistanceSquare;
  var isRemoveHandleData;
  var isConnectMiddle;
  var closePathCondition;
  var unequalProperty;
  var isReverseAngle;
  var isReverseAngleFlg;
  var gapAllowRad;
  var RB_MERGE = {
    OTHER : 0,  // 他のパスとの連結
    CLOSE : 1,  // 同じパスの両端を連結
    BOTH  : 2,  // 両方
  };
  var RB_CONNECT = {
    MIDDLE : 0,  // 2点を中間位置に移動
    ADD    : 1,  // 2点を繋ぐ線を追加
  };
  var ANGLE_ABSORPTION = 0.001;  // 角度を比較する時に発生する計算誤差の許容量
  var ANCHOR = PathPointSelection.ANCHORPOINT;
  var POSITIVE = PolarityValues.POSITIVE;
  var NEGATIVE = PolarityValues.NEGATIVE;
  var atan2 = Math.atan2;
  var abs = Math.abs;
  var PI = Math.PI;

  // オープンパスを探して配列に保存
  function iter2extractPaths(items) {
    for (var i = 0, len = items.length; i < len; i++)
      extractPaths(items[i]);
  }
  function extractPaths(pageItem) {
    switch (pageItem.typename) {
      case 'PathItem':
        if (!pageItem.closed) {
          pathObj[pathCount] = pageItem;
          pathObj[pathCount].isAnchorStart = pageItem.pathPoints[0].selected === ANCHOR;
          pathObj[pathCount].isAnchorEnd = pageItem.pathPoints[pageItem.pathPoints.length - 1].selected === ANCHOR;
          if (pathObj[pathCount].isAnchorStart) edgeAnchorCount++;
          if (pathObj[pathCount].isAnchorEnd) edgeAnchorCount++;
          skipPathArr[pathCount] = false;
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
    var mergeFunc;
    var joinCount = 0;
    var closePathCount = 0;

    //----------------------
    // 設定変換
    settings = eval(args);

    // アンカーの距離が指定値より近いか計算する用
    connectDistanceSquare = settings.connectDistance * settings.connectDistance;
    // ハンドルデータを保持するかどうか
    isRemoveHandleData = !settings.keepHandleData;

    // 中間位置で連結する時は4つ、間に線を追加する時はアンカーポイントが3つ以上なければ連結しない
    isConnectMiddle = settings.rbConnect === RB_CONNECT.MIDDLE;
    closePathCondition = isConnectMiddle ? 4 : 3;

    // 連結対象
    mergeFunc = (function() {
      switch (settings.rbMerge) {
        case RB_MERGE.OTHER:
          return function(index) {
            joinCount += mergeAnchor(index);
          };
        case RB_MERGE.CLOSE:
          return function(index) {
            closePathCount += mightClosePath(pathObj[index]);
          };
        case RB_MERGE.BOTH:
          return function(index) {
            joinCount += mergeAnchor(index);
            closePathCount += mightClosePath(pathObj[index]);
          };
        default:
          throw new RangeError('[連結対象]');
      }
    }());

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

    // 角度比較をするかどうか
    isReverseAngleFlg = (settings.horizontal || settings.vertical);
    // 角度計算許容量
    gapAllowRad = conv2radian(settings.gapAllowDeg + ANGLE_ABSORPTION);
    // 角度比較をどの軸で行うか
    isReverseAngle = (function() {
      // 圧縮後の三項演算子の処理順問題を回避するためにswitchを使う(雑)
      var type = 0;
      if (settings.vertical && settings.horizontal)
        type = 2;
      else if (settings.horizontal)
        type = 1;
      switch (type) {
        case 2:
          return function(pos1, pos2, pos3, pos4) {
            return isReverseAngleHorizontalVertical(getRadian(pos1, pos2), getRadian(pos3, pos4));
          };
        case 1:
          return function(pos1, pos2, pos3, pos4) {
            return isReverseAngleHorizontal(getRadian(pos1, pos2), getRadian(pos3, pos4));
          };
        default:
          return function(pos1, pos2, pos3, pos4) {
            return isReverseAngleVertical(getRadian(pos1, pos2), getRadian(pos3, pos4));
          };
      }
    }());

    //----------------------
    // ウィンドウ作成
    winProgress = new Window('palette', '処理中は最小化しないでください', undefined, {closeButton: false});
    var progressBar = winProgress.add('progressbar', [0, 0, 300, 16], 0, 100);
    var staticTextProgressInfo = winProgress.add('statictext', [0, 0, 300, 16], 'パス取得中…');
    winProgress.spacing = 8;
    winProgress.orientation = 'column';
    winProgress.alignChildren = ['left', 'top'];
    winProgress.center();
    winProgress.show();

    //----------------------
    // 選択オブジェクトからオープンパスを取得
    iter2extractPaths(app.activeDocument.selection);

    if (edgeAnchorCount < 2) {
      alert('パスの端にあるアンカーポイントを２つ以上選択してください');
      return false;
    }
    // 他のパスと連結する時は２つ以上パスを選択
    if (settings.rbMerge === RB_MERGE.OTHER) {
      if (pathCount < 2) {
        alert('パスを２つ以上選択してください');
        return false;
      }
    }
    $.writeln('path:' + pathCount + ' edgeAnchor:' + edgeAnchorCount);
    progressBar.maxvalue = pathCount;

    //----------------------
    // 連結処理ループ
    for (var j = 0; j < pathCount; j++) {
      if ((j & 63) === 0)  // j % 64 === 0
        winProgress.update();
      progressBar.value = j + skipPathCount;
      staticTextProgressInfo.text = j + '/' + pathCount +
        ' (join:' + joinCount +
        ' close:' + closePathCount +
        ')';

      if (skipPathArr[j])
        continue;
      mergeFunc(j);
    }
    $.writeln(staticTextProgressInfo.text);

    //----------------------
    // 結果をコールバックへ返す
    result.pathCount = pathCount;
    result.joinCount = joinCount;
    result.closePathCount = closePathCount;
    return result.toSource();
  }
  catch (e) {
    // %0A で改行
    alert(unescape(e), 'Error', true);
    return false;
  }
  finally {
    winProgress.close();
  }