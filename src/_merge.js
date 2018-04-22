// アンカーポイントとハンドルの位置をセット
function setPoint(pathPoint, pos) {
  var diffPos = [pathPoint.anchor[0] - pos[0], pathPoint.anchor[1] - pos[1]];
  pathPoint.anchor = pos;
  pathPoint.leftDirection = [pathPoint.leftDirection[0] - diffPos[0], pathPoint.leftDirection[1] - diffPos[1]];
  pathPoint.rightDirection = [pathPoint.rightDirection[0] - diffPos[0], pathPoint.rightDirection[1] - diffPos[1]];
}

// パスの向きを反転させる
function reversePolarity(path) {
  if (path.polarity === POSITIVE)
    path.polarity = NEGATIVE;
  else
    path.polarity = POSITIVE;
}

// ハンドル情報を削除
function removeEdgeAnchorHandleData(pathA, pathB) {
  var pathAPointEnd = pathA.pathPoints[pathA.pathPoints.length - 1];
  var pathBPointStart = pathB.pathPoints[0];
  pathAPointEnd.rightDirection = pathAPointEnd.anchor;
  pathBPointStart.leftDirection = pathBPointStart.anchor;
  if (isConnectMiddle) {
    pathAPointEnd.leftDirection = pathAPointEnd.anchor;
    pathBPointStart.rightDirection = pathBPointStart.anchor;
  }
}

// パスの最初と最後のアンカーポイントの差が一定値以下なら連結
function mightClosePath(path) {
  if (!path.closed && path.pathPoints.length >= closePathCondition) {
    var pathPointStart = path.pathPoints[0];
    var pathPointEnd = path.pathPoints[path.pathPoints.length - 1];
    if (path.isAnchorStart && path.isAnchorEnd && isNearDistance(pathPointStart.anchor, pathPointEnd.anchor)) {
      path.closed = true;

      if (isRemoveHandleData)
        removeEdgeAnchorHandleData(path, path);

      if (isConnectMiddle) {
        var pos = getMiddlePos(pathPointStart.anchor, pathPointEnd.anchor);
        setPoint(pathPointStart, pos);
        setPoint(pathPointEnd, pos);
        pathPointStart.leftDirection = pathPointEnd.leftDirection;
        pathPointEnd.remove();
      }
      closePathCount++;
    }
  }
}

// 2点を比較し条件を満たしたらBをAで上書きする
// arg: {index: pathsのインデックス, isStart: 始点か終点か}
// 連結した場合trueを返す
function mergeAnchor(objA, objB) {
  var iA = objA.index;
  var iB = objB.index;
  if (iA === iB)
    return false;
  if (isSkipPaths[iA] || isSkipPaths[iB])
    return false;

  var pathA = paths[iA];
  var pathB = paths[iB];

  //----------------------
  // 連結する条件を満たしているかチェック
  // 指定したプロパティが一致していなければreturn
  if (unequalProperty(pathA, pathB))
    return false;

  // 選択・角度・距離のチェック
  var joinFlg = (function() {   // eslint-disable-line consistent-return
    var pathAStart, pathAEnd, pathBStart, pathBEnd;
    var a = objA.isStart ? 0x01 : 0;
    var b = objB.isStart ? 0x10 : 0;
    switch (a | b) {
      case 0x10:
        if (pathA.isAnchorEnd && pathB.isAnchorStart) {
          pathAEnd = pathA.pathPoints[pathA.pathPoints.length - 1].anchor;
          pathBStart = pathB.pathPoints[0].anchor;
          if (isNearDistance(pathAEnd, pathBStart)) {
            if (isReverseAngle) {
              pathAStart = pathA.pathPoints[0].anchor;
              pathBEnd = pathB.pathPoints[pathB.pathPoints.length - 1].anchor;
              if (!isReverseAngle(pathAEnd, pathAStart, pathBStart, pathBEnd))
                return false;
            }
            return true;
          }
        }
        return false;
      case 0x11:
        if (pathA.isAnchorStart && pathB.isAnchorStart) {
          pathAStart = pathA.pathPoints[0].anchor;
          pathBStart = pathB.pathPoints[0].anchor;
          if (isNearDistance(pathAStart, pathBStart)) {
            if (isReverseAngle) {
              pathAEnd = pathA.pathPoints[pathA.pathPoints.length - 1].anchor;
              pathBEnd = pathB.pathPoints[pathB.pathPoints.length - 1].anchor;
              if (!isReverseAngle(pathAStart, pathAEnd, pathBStart, pathBEnd))
                return false;
            }
            reversePolarity(pathA);
            return true;
          }
        }
        return false;
      case 0x00:
        if (pathA.isAnchorEnd && pathB.isAnchorEnd) {
          pathAEnd = pathA.pathPoints[pathA.pathPoints.length - 1].anchor;
          pathBEnd = pathB.pathPoints[pathB.pathPoints.length - 1].anchor;
          if (isNearDistance(pathAEnd, pathBEnd)) {
            if (isReverseAngle) {
              pathAStart = pathA.pathPoints[0].anchor;
              pathBStart = pathB.pathPoints[0].anchor;
              if (!isReverseAngle(pathAEnd, pathAStart, pathBEnd, pathBStart))
                return false;
            }
            reversePolarity(pathB);
            return true;
          }
        }
        return false;
      case 0x01:
        if (pathA.isAnchorStart && pathB.isAnchorEnd) {
          pathAStart = pathA.pathPoints[0].anchor;
          pathBEnd = pathB.pathPoints[pathB.pathPoints.length - 1].anchor;
          if (isNearDistance(pathAStart, pathBEnd)) {
            if (isReverseAngle) {
              pathAEnd = pathA.pathPoints[pathA.pathPoints.length - 1].anchor;
              pathBStart = pathB.pathPoints[0].anchor;
              if (!isReverseAngle(pathAStart, pathAEnd, pathBEnd, pathBStart))
                return false;
            }
            reversePolarity(pathA);
            reversePolarity(pathB);
            return true;
          }
        }
        return false;
      // no default
    }
  }());

  //----------------------
  // ２つのパスを繋げる
  if (joinFlg) {
    var newPoint;
    var pathAPoint = pathA.pathPoints[pathA.pathPoints.length - 1];
    var pathBPoint = pathB.pathPoints[0];
    var pathBPointIndex = 0;
    var pathBPointLength = pathB.pathPoints.length;

    // 中間位置に移動
    if (isConnectMiddle) {
      var pos = getMiddlePos(pathAPoint.anchor, pathBPoint.anchor);
      setPoint(pathAPoint, pos);
      setPoint(pathBPoint, pos);
      // 同じ位置になるので片側のハンドルをコピーしてインデックスを進める
      pathAPoint.rightDirection = pathBPoint.rightDirection;
      pathBPointIndex++;
    }

    if (isRemoveHandleData)
      removeEdgeAnchorHandleData(pathA, pathB);

    // AにBを追加してBを削除
    while (pathBPointLength > pathBPointIndex) {
      pathBPoint = pathB.pathPoints[pathBPointIndex++];
      newPoint = pathA.pathPoints.add();
      newPoint.anchor = pathBPoint.anchor;
      newPoint.leftDirection = pathBPoint.leftDirection;
      newPoint.rightDirection = pathBPoint.rightDirection;
      newPoint.pointType = pathBPoint.pointType;
    }
    pathB.remove();

    // 削除したパスを登録
    isSkipPaths[iB] = true;

    joinCount++;

    return true;
  }
  return false;
}
