MergeOpenPath
====

オープンパス同士や同じパスの両端を連結するIllustrator用スクリプト。

![Screenshot](https://github.com/twilyze/Illustrator-MergeOpenPath/blob/master/image/main_window.png)


## ダウンロード
[Releasesページ](https://github.com/twilyze/Illustrator-MergeOpenPath/releases)


## 使い方
[ファイル]-[スクリプト]-[その他のスクリプト] から選択するか、
あらかじめスクリプトフォルダにファイルを配置すれば [ファイル]-[スクリプト] 内に表示されます。

  スクリプトフォルダは大体以下の場所  
  [Win] "Program Files/Adobe/Adobe Illustrator (バージョン名)/プリセット/ja_JP/スクリプト"  
  [Mac] "アプリケーション/Adobe Illustrator (バージョン名)/プリセット/ja_JP/スクリプト"

スクリプトを起動したら連結したいパスを選択して実行します。

### 詳しい説明
そのうち

### 注意
- 念の為実行前に保存しましょう
- 別のグループや複合パス同士でも条件を満たせば連結します
- 複合パスの中にあるグループは無視されます（スクリプトからはアクセスできない）
- 総当たりなのでパスの数が多い場合動いてないように見えるかも知れませんがたぶん動いてます
- 処理中にIllustratorを最小化すると処理が終わるまで表示できなくなりますがたぶん動いてます

- 基本的に最前面のパスから連結可能なパスを見つけ次第連結していきます
  - 距離が近い順に全て連結したい場合はshspageさんのスクリプトをお使いください
    > [s.h's page - [Illustrator] JavaScript scripts](http://shspage.com/aijs/#renketsu)


## 動作確認環境
Adobe Illustrator CS5.1 (Windows10 64bit)


## お問い合わせ
[Googleフォーム](https://goo.gl/forms/COrRnU3ME2gcIzj62)  
[Twitter](https://twitter.com/twilyze)


## ライセンス
[MIT](https://github.com/twilyze/Illustrator-MergeOpenPath/blob/master/LICENSE)
