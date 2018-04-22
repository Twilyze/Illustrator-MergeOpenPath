// 線形四分木空間分割による近接判定
// 空間階層のことをレベル、各小空間のことをセルと呼ぶことにする。
var LinearQuadtreePartition = new function() {
  //----------------------
  // private
  //----------------------
  var _cells;
  var _cellsLength;
  var _startIndex;
  var _xOffset;
  var _yOffset;
  var _cellWidth;
  var _cellHeight;
  var _lowestLevel;
  var _radius;
  var _push = Array.prototype.push;
  var _MAXLEVEL = 6;

  // 要素を_cellsに追加する。
  // 必要なのは要素と、レベルと、レベル内での番号。
  function _addNode(node, level, index) {
    var linearIndex = _startIndex[level] + index;

    // セルが存在しない（null）なら、そのセルと親全てを作成（空配列で初期化）する
    var parentCellIndex = linearIndex;
    while (_cells[parentCellIndex] === null) {
      _cells[parentCellIndex] = [];

      parentCellIndex = (parentCellIndex - 1) >> 2; // Math.floor((parentCellIndex - 1) / 4)
    }

    // セルに要素を追加し、自身が格納された場所を返す
    var ownIndex = _cells[linearIndex].push(node) - 1;
    return [linearIndex, ownIndex];
  }

  // 16bitの数値を1bit飛ばしの32bitにする
  function _separateBit32(n) {
    n = (n | (n << 8)) & 0x00ff00ff;
    n = (n | (n << 4)) & 0x0f0f0f0f;
    n = (n | (n << 2)) & 0x33333333;
    return (n | (n << 1)) & 0x55555555;
  }

  // x, y座標からモートン番号を算出する。
  function _calc2DMortonNumber(x, y) {
    // 空間の中の位置を求める
    var xCell = floor(x / _cellWidth);
    var yCell = floor(y / _cellHeight);

    // x位置とy位置をそれぞれ1bit飛ばしの数にし、それらをあわせてひとつの数にする。
    // これがモートン番号となる。
    return (_separateBit32(xCell) | (_separateBit32(yCell) << 1));
  }

  // 4分木を全て巡りパスの連結判定を行う
  // 最初に渡す引数は(0, [])
  function _iterTree(currentIndex, objList) {
    var currentCell = _cells[currentIndex];

    // 現在のセル内と、衝突オブジェクトリストとで判定する
    _mergeAnchorInCell(currentCell, currentCell, 1);
    _mergeAnchorInCell(currentCell, objList, 0);

    // 次に下位セルを持つか調べる
    var hasChildren = false, nextIndex;
    for (var i = 0; i < 4; i++) {
      nextIndex = currentIndex * 4 + 1 + i;
      if (nextIndex < _cellsLength && _cells[nextIndex] !== null) {
        if (!hasChildren) {
          // 現在のセルを衝突オブジェクトリストに追加
          _push.apply(objList, currentCell);
        }
        hasChildren = true;
        // 下位セルへ
        _iterTree(nextIndex, objList);
      }
    }

    // 追加したオブジェクトを削除する
    if (hasChildren)
      objList.splice(objList.length - currentCell.length);
  }
  // 渡されたオブジェクトが存在していればパス連結関数へ渡す
  // adjustはセル内の判定なら1、衝突オブジェクトリストとの判定なら0にする
  function _mergeAnchorInCell(objA, objB, adjust) {
    var lenA = objA.length - adjust;
    var lenB = objB.length;
    var a, b, datA, datB;
    for (a = 0; a < lenA; a++) {
      datA = objA[a];
      if (datA === null) continue;
      for (b = a + adjust; b < lenB; b++) {
        datB = objB[b];
        if (datB === null) continue;
        if (mergeAnchor(datA, datB)) {
          // パスを連結（BをAで上書き）したら連結点の反対側の情報を書き換える
          // （pairには反対側の情報が入っている位置が保存されている）

          // Bの反対側のindexをAに変更
          _cells[datB.pair[0]][datB.pair[1]].index = datA.index;
          // Bの反対側のpairをAのものに変更
          _cells[datB.pair[0]][datB.pair[1]].pair = datA.pair;
          // Aの反対側のpairをBのものに変更
          _cells[datA.pair[0]][datA.pair[1]].pair = datB.pair;

          // 連結時に必要ならパスの向きを変更するので反対側の情報にも反映させる
          if (datA.isStart)
            _cells[datA.pair[0]][datA.pair[1]].isStart = true;
          if (!datB.isStart)
            _cells[datB.pair[0]][datB.pair[1]].isStart = false;

          // 連結点の情報は必要ないので消去（これで_cellsの方も消える）
          objA[a] = null;
          objB[b] = null;
          break;
        }
      }
    }
  }

  //----------------------
  // public
  //----------------------
  var _public = {
    init : function(bounds, level, radius) {
      $.writeln('-init()-');
      var ABSORPTION = 0.00001;  // 計算誤差吸収用
      if (level > _MAXLEVEL)
        level = _MAXLEVEL;

      // 各レベルの始点番号を保存
      _startIndex = [];
      for (var i = 0, len = level + 1; i <= len; i++)
        _startIndex[i] = (pow(4, i) - 1) / 3;

      // 入力レベルまで_cellsを伸長する
      _cells = [];
      var length = _startIndex[level + 1];
      for (var j = 0; j < length; j++)
        _cells[j] = null;
      _cellsLength = _cells.length;

      // 左上を0に合わせるためのオフセット
      _xOffset = -bounds[0] + radius + ABSORPTION;
      _yOffset = -bounds[3] + radius + ABSORPTION;

      var diameter = (radius + ABSORPTION) * 2;
      var width = abs(bounds[2] - bounds[0]) + diameter;
      var height = abs(bounds[3] - bounds[1]) + diameter;
      var sideNum = 1 << level;  // pow(2, level)
      _cellWidth = width / sideNum;
      _cellHeight = height / sideNum;

      _lowestLevel = level;
      _radius = radius;
    },
    // パスの端にあるアンカーの情報を線形四分木に登録する
    // アンカーの位置に連結距離を足した範囲からモートン番号を計算し、適切なセルに割り当てる。
    regist : function(paths) {
      $.writeln('-regist()-');
      var i, j, k;
      var node, nodeIndex, pos, path;
      var x, y, leftTopMorton, rightBottomMorton, xorMorton, hiLevel, check, cellNumber;
      for (i = 0, len = paths.length; i < len; i++) {
        node = [], nodeIndex = [], pos = [];
        path = paths[i];
        node[0] = {index: i, isStart: true};
        node[1] = {index: i, isStart: false};
        pos[0] = path.pathPoints[0].anchor;
        pos[1] = path.pathPoints[path.pathPoints.length - 1].anchor;
        for (j = 0; j < 2; j++) {
          // モートン番号の計算
          x = pos[j][0] + _xOffset;
          y = pos[j][1] + _yOffset;
          leftTopMorton = _calc2DMortonNumber(x - _radius, y + _radius);
          rightBottomMorton = _calc2DMortonNumber(x + _radius, y - _radius);

          // ひとつのセルに収まっている時は特に計算もせずそのまま現在のレベルのセルに入れる
          if (leftTopMorton === rightBottomMorton) {
            nodeIndex[j] = _addNode(node[j], _lowestLevel, leftTopMorton);
            continue;
          }

          // 空間番号の排他的論理和から所属レベルを算出
          xorMorton = leftTopMorton ^ rightBottomMorton;
          hiLevel = 0;
          for (k = 0; k < _lowestLevel; k++) {
            check = (xorMorton >> (k * 2)) & 0x3;
            if (check !== 0)
              hiLevel = k + 1;
          }
          // 階層を求めるときにシフトした回数だけ右シフトすれば空間の位置がわかる
          cellNumber = rightBottomMorton >> (hiLevel * 2);

          nodeIndex[j] = _addNode(node[j], _lowestLevel - hiLevel, cellNumber);
        }
        // 反対側の情報保存場所を登録
        _cells[nodeIndex[0][0]][nodeIndex[0][1]].pair = nodeIndex[1];
        _cells[nodeIndex[1][0]][nodeIndex[1][1]].pair = nodeIndex[0];
      }
    },
    start : function() {
      $.writeln('-start()-');
      _iterTree(0, []);
    }
  };
  return _public;
};
