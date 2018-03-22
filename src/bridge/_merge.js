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
        return 1;
      }
    }
    return 0;
  }

  // 1点とそれ以降の点を比較し連結する
  function mergeAnchor(iA) {
    var joinFlg = false;
    var iB = iA + 1;
    var reverseFlg = true;

    var pathA = pathObj[iA];
    var pathAPointStart = pathA.pathPoints[0];
    var pathAPointEnd = pathA.pathPoints[pathA.pathPoints.length - 1];
    var pathAStart = pathAPointStart.anchor;
    var pathAEnd = pathAPointEnd.anchor;

    var pathB, pathBPointStart, pathBPointEnd, pathBStart, pathBEnd;
    for (; iB < pathCount; iB++) {
      if (skipPathArr[iB])
        continue;

      pathB = pathObj[iB];
      pathBPointStart = pathB.pathPoints[0];
      pathBPointEnd = pathB.pathPoints[pathB.pathPoints.length - 1];
      pathBStart = pathBPointStart.anchor;
      pathBEnd = pathBPointEnd.anchor;

      //----------------------
      // 連結する条件を満たしているかチェック
      // 指定したプロパティが一致していなければconticue
      if (unequalProperty(pathA, pathB))
        continue;

      // 選択・角度・距離のチェック
      if (pathA.isAnchorEnd && pathB.isAnchorStart) {
        if (isReverseAngleFlg)
          reverseFlg = isReverseAngle(pathAEnd, pathAStart, pathBStart, pathBEnd);
        if (reverseFlg && isNearDistance(pathAEnd, pathBStart)) {
          joinFlg = true;
          break;
        }
      }
      if (pathA.isAnchorStart && pathB.isAnchorStart) {
        if (isReverseAngleFlg)
          reverseFlg = isReverseAngle(pathAStart, pathAEnd, pathBStart, pathBEnd);
        if (reverseFlg && isNearDistance(pathAStart, pathBStart)) {
          reversePolarity(pathA);
          joinFlg = true;
          break;
        }
      }
      if (pathA.isAnchorEnd && pathB.isAnchorEnd) {
        if (isReverseAngleFlg)
          reverseFlg = isReverseAngle(pathAEnd, pathAStart, pathBEnd, pathBStart);
        if (reverseFlg && isNearDistance(pathAEnd, pathBEnd)) {
          reversePolarity(pathB);
          joinFlg = true;
          break;
        }
      }
      if (pathA.isAnchorStart && pathB.isAnchorEnd) {
        if (isReverseAngleFlg)
          reverseFlg = isReverseAngle(pathAStart, pathAEnd, pathBEnd, pathBStart);
        if (reverseFlg && isNearDistance(pathAStart, pathBEnd)) {
          reversePolarity(pathA);
          reversePolarity(pathB);
          joinFlg = true;
          break;
        }
      }
    }

    //----------------------
    // ２つのパスを繋げる
    if (joinFlg) {
      var newPoint;
      var pathBPoint = pathB.pathPoints[0];
      var pathBPointIndex = 0;
      var pathBPointLength = pathB.pathPoints.length;

      // 中間位置に移動
      if (isConnectMiddle) {
        var pos = getMiddlePos(pathAPointEnd.anchor, pathBPoint.anchor);
        setPoint(pathAPointEnd, pos);
        setPoint(pathBPoint, pos);
        // 同じ位置になるので片側のハンドルをコピーしてインデックスを進める
        pathAPointEnd.rightDirection = pathBPoint.rightDirection;
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
      skipPathArr[iB] = true;
      skipPathCount++;

      // 別のパスとも連結できるか試す
      return 1 + mergeAnchor(iA);
    }
    return 0;
  }
