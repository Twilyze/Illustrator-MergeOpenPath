  $.writeln('-- BridgeTalk() --');
  $.writeln('1' + $.summary());
  //----------------------
  // BridgeTalk()
  var winProgress;
  var pathObj = [];
  var pathCount = 0;
  var joinCount = 0;
  var closePathCount = 0;
  var activeBounds;
  var result = {};
  var skipPathArr = [];
  var edgeAnchorCount = 0;
  var settings;
  var connectDistanceSquare;
  var isRemoveHandleData;
  var isConnectMiddle;
  var closePathCondition;
  var unequalProperty;
  var isReverseAngle;
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
  var floor = Math.floor;
  var pow = Math.pow;
  var abs = Math.abs;
  var PI = Math.PI;

  function updateWindow(str) {
    winProgress.staticTextProgressInfo.text = str;
    winProgress.update();
  }
  function clearObj(obj) {
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        obj[key] = null;
        delete obj[key];
      }
    }
    obj = null;
  }
  function clearArr(arr) {
    for (var i = 0, len = arr.length; i < len; i++) {
      arr[i] = null;
      delete arr[i];
    }
    arr = null;
  }

  // オープンパスを探して配列に保存
  function iter2extractPaths(items) {
    for (var i = 0, len = items.length; i < len; i++)
      extractPaths(items[i]);
  }
  function extractPaths(pageItem) {
    switch (pageItem.typename) {
      case 'PathItem':
        if (!pageItem.closed && !pageItem.hidden && !pageItem.locked) {
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
    // ウィンドウ作成
    winProgress = new Window('palette', '処理中は最小化しないでください', undefined, {closeButton: false});
    winProgress.staticTextProgressInfo = winProgress.add('statictext', [0, 0, 240, 16], 'パス取得中…');
    winProgress.spacing = 8;
    winProgress.orientation = 'column';
    winProgress.alignChildren = ['left', 'top'];
    winProgress.center();
    winProgress.show();

    //----------------------
    // 選択オブジェクトからオープンパスを取得
    var activeSelection = app.activeDocument.selection;
    activeBounds = activeSelection[0].geometricBounds;
    iter2extractPaths(activeSelection);
    $.writeln('2' + $.summary());

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

    //----------------------
    // 他のパスとの連結処理
    if (settings.rbMerge !== RB_MERGE.CLOSE) {
      updateWindow('4分木初期化中…');
      var level = 0;
      if (pathCount > 20)
        level = Math.floor(pathCount / 800) + 3;  // 適当
      LinearQuadtreePartition.init(activeBounds, level, settings.connectDistance);
      updateWindow('4分木登録中…');
      LinearQuadtreePartition.regist(pathObj);
      updateWindow('他のパスとの連結中…');
      LinearQuadtreePartition.start();
    }

    //----------------------
    // パスのクローズ処理
    if (settings.rbMerge !== RB_MERGE.OTHER) {
      updateWindow('同じパスの両端を連結中…');
      for (var i = 0; i < pathCount; i++) {
        if (skipPathArr[i])
          continue;
        mightClosePath(pathObj[i]);
      }
    }

    //----------------------
    // 結果をコールバックへ返す
    updateWindow('終了処理中…');
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
    winProgress = null;
    clearArr(skipPathArr);
    clearObj(settings);
    clearObj(activeBounds);
    clearObj(LinearQuadtreePartition);
    clearArr(pathObj);
    $.gc();
    $.gc();
    $.writeln('3' + $.summary());
  }