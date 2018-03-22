  // ２点間の距離が指定値以下かどうか
  function isNearDistance(pos1, pos2) {
    var tmp1 = pos1[0] - pos2[0];
    var tmp2 = pos1[1] - pos2[1];
    return tmp1 * tmp1 + tmp2 * tmp2 <= connectDistanceSquare;
  }
  // ２点の中間位置
  function getMiddlePos(pos1, pos2) {
    return ([(pos1[0] + pos2[0]) * 0.5, (pos1[1] + pos2[1]) * 0.5]);
  }
  // ２点の位置から角度を取得
  function getRadian(pos1, pos2) {
    return atan2(pos2[1] - pos1[1], pos2[0] - pos1[0]);
  }

  // 度->ラジアンの変換
  function conv2radian(deg) {
    return deg * 0.01745329251994; // Math.PI / 180
  }

  // 2つのオブジェクトが同じ内容か比較する(簡易)
  function equalsObject(obj1, obj2) {   // eslint-disable-line no-unused-vars
    for (var key in obj1)
      if (obj1[key] !== obj2[key])
        return false;
    return true;
  }

  // 2つの配列が同じ内容か比較する(簡易)
  function equalsArray(a, b) {   // eslint-disable-line no-unused-vars
    if (a.length !== b.length)
      return false;
    for (var i = 0, len = a.length; i < len; i++)
      if (a[i] !== b[i])
        return false;
    return true;
  }

  // 角度が横軸で対になっているか
  function isReverseAngleHorizontal(rad1, rad2) {
    return abs(rad1 + rad2) < gapAllowRad;
  }
  // 角度が縦軸で対になっているか
  function isReverseAngleVertical(rad1, rad2) {
    return abs(abs(rad1 + rad2) - PI) < gapAllowRad;
  }
  // 角度が縦軸・横軸で対になっているか
  function isReverseAngleHorizontalVertical(rad1, rad2) {
    return abs(abs(rad1 - rad2) - PI) < gapAllowRad;
  }
