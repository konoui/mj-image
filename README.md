## 仕様

### 牌

| 牌     | 記述                                                    |
| ------ | ------------------------------------------------------- |
| 萬子牌 | 1m 2m 3m ... 9m                                         |
| 筒子牌 | 1p 2p 3p ... 9p                                         |
| 索子牌 | 1s 2s 3s ... 9s                                         |
| 風牌   | 1z(東) 2z(南) 3z(西) 4z(北) 1w(東) 2w(南) 3w(西) 4w(北) |
| 三元牌 | 5z(白) 6z(發) 7z(中) 1d(白) 2d(發) 3d(中)               |
| 赤ドラ | 0m 0p 0s 　                                             |
| 裏牌   | \_                                                      |

※ 風牌の w は wind の、三元牌の d は dragon の略

### 制御文字

| 記号 | 説明               | 記載例      |
| ---- | ------------------ | ----------- |
| \-   | 横向きの牌を表す   | -123s       |
| ,    | ブロックの塊を表す | 123,-123    |
| t    | ツモ牌を表す       | 123,t3p     |
| d    | ドラ牌を表す       | 123,t3p,d4p |

### 入力例方法

例 1）
456m456s456p1w2w3w1d,t2p,d3p

例 2）
23789p, t1w, -456p, 9-99p, d3p

※ スペースは無視されます。

### 牌画像

[【保存版】商用無料の高クオリティーの麻雀画像の無料素材まとめ](https://majandofu.com/mahjong-images)

## 使い方

```html
<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
  </head>
  <body>
    <h1>Example</h1>
    <div id="container">
      手配1:
      <code class="mjimage">123s123m123p, -1-111z, t3d, d4m</code>
      <br />
      <code class="mjimage">123s</code>は3色です。
    </div>
    <script src="https://d257lmna3z6el8.cloudfront.net/global.js"></script>
    <script>
      mjimage.initialize({
        imageHostUrl: "https://d257lmna3z6el8.cloudfront.net/svg/",
      });
    </script>
  </body>
</html>
```
