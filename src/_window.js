var MARGIN = 8;
var groups = {};

// 設定用UI追加
function iter2addControl(settings, window) {
  for (var key in settings)
    if (settings.hasOwnProperty(key))
      addControl(settings, window, key);
}
function addControl(settings, window, key) {
  var set = settings[key];
  var type = set.type;
  switch (type) {
    case 'panel':
      var panel = window.add('panel', undefined, set.title);
      panel.alignChildren = ['left', 'top'];
      panel.margins = [MARGIN * 1.5, MARGIN * 1.5, MARGIN, MARGIN];
      panel.spacing = MARGIN * 0.75;
      iter2addControl(set.items, panel);
      return;
    case 'checkbox':
      var win = window;
      if (set.group) {
        if (groups[set.group])
          win = groups[set.group];
        else
          win = groups[set.group] = window.add('group');
      }
      controls[key] = win.add(type, undefined, set.title);
      controls[key].value = set.value;
      if (set.name) controls[key].name = set.name;
      if (set.equals) controls[key].equals = set.equals;
      break;
    case 'radiobutton':
      var rbPanel = window.add('panel', undefined, set.title);
      rbPanel.margins = [MARGIN * 1.5, MARGIN * 1.5, MARGIN, MARGIN];
      rbPanel.spacing = MARGIN * 0.5;
      rbPanel.alignment = 'fill';
      rbPanel.orientation = 'column';
      rbPanel.alignChildren = ['left', 'top'];
      for (var i = 0, len = set.items.length; i < len; i++)
        controls[key + '_' + i] = rbPanel.add(type, undefined, set.items[i]);
      key = key + '_0';
      controls[key].value = true;
      break;
    case 'edittext':
      var edGroup = window.add('group');
      edGroup.add('statictext', undefined, set.title);
      controls[key] = edGroup.add(type, [0, 0, 44, 21], set.value);
      break;
    case 'slider':
      var slPanel = window.add('panel', undefined, set.title);
      slPanel.margins = [MARGIN, MARGIN * 2, MARGIN * 2, MARGIN];
      slPanel.alignment = 'fill';
      var slGroup = slPanel.add('group');
      var slider = slGroup.add(type, [0, 0, 125, 22], set.value * 10, 0, 100);
      slider.onChanging = function() {
        controls[key].text = slider.value * 0.1;
      };
      controls[key] = slGroup.add('edittext', [0, 0, 44, 21], set.value);
      break;
    // no default
  }
  if (set.helpTip)
    controls[key].helpTip = set.helpTip;
}

// メイン画面作成
function createGUI() {
  $.writeln('--- createGUI ---');
  var win;
  try {
    win = new Window('palette', SCRIPT_TITLE + ' - ' + SCRIPT_VERSION);
    win.margins = 0;

    var columnGroup = win.add('group');
    columnGroup.margins = [MARGIN * 1.5, MARGIN * 1.25, MARGIN * 1.5, MARGIN * 1.5];
    columnGroup.spacing = MARGIN;
    columnGroup.orientation = 'column';
    columnGroup.alignment = ['left', 'top'];
    columnGroup.alignChildren = ['fill', 'top'];

    // 設定オブジェクトからUI追加
    iter2addControl(settings, columnGroup);

    // 実行ボタン
    win.buttonRun = columnGroup.add('button', [0, 0, 74, 32], '実行');

    // リザルト
    win.listboxResult = columnGroup.add('listbox');
    win.listboxResult.minimumSize = [200, 42];
    win.listboxResult.helpTip = '[] 連結数 (クローズ数) / 選択オープンパス数  処理時間';
  }
  catch (e) {
    alert(e, 'Error', true);
    return false;
  }
  return win;
}
