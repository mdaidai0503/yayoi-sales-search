弥生販売 売上履歴検索 PWA v1.0.0 正式最新版

■ 独立アプリ
業務管理ポータルとは別アプリです。既存ポータルは変更しません。

■ 検索
得意先名 / 商品名 / 商品コード / 伝票番号 / 開始日 / 終了日
結果は50件ずつ表示します。52,083件を端末へ一括取得しません。

■ セキュリティ
PWAにはSupabase Secret keyを入れていません。
フロントエンドには公開可能なPublishable keyのみを使用します。
ログイン後のアクセストークンを使ってEdge Functionを呼び出します。
Edge Function側でログインユーザーを検証した後に検索します。

■ 公開
GitHub Pages等のHTTPS環境へ、このZIP内のファイルを展開してアップロードしてください。
index.html / app.js / manifest.webmanifest / sw.js / icon.svg が同じ階層に必要です。

■ ログイン
Supabase Authに登録済みのメールアドレスとパスワードを使用します。
アカウント作成画面はこのPWAには設けていません。
