/*
 * The strings x.com was asked about.
 *
 * This generator was pasted into the page at x.com/compose/post on 9 October
 * 2026 and run there, and x.com's own counting functions answered for every
 * string it makes: 1,731,072 of them across four parts. The digests of those
 * answers are in tools/x-live.json, and test/reference/x-live.test.js checks
 * that this package gives the same answers, digest for digest.
 *
 * So the function below is a record, not a utility: its text is pinned by
 * hash (x-live.json, "generator"), because the digests mean nothing for any
 * other text. Plain JavaScript with no escapes in it, so it survives being pasted.
 */
export function makeCorpus(part) {
  var U = function () { return String.fromCodePoint.apply(null, arguments); };
  var C = function () { return String.fromCharCode.apply(null, arguments); };
  var seed = [20261003, 20261009, 777, 4242][part];
  var a = seed >>> 0;
  var next = function () {
    a = (a + 0x6d2b79f5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  var pick = function (list) { return list[Math.floor(next() * list.length)]; };
  var rep = function (s, n) { var o = ''; for (var i = 0; i < n; i++) o += s; return o; };
  var FRAG = [
    'a', 'b', 'Z', '0', '9', ' ', ' ', '  ', C(10), C(9), '.', '.', '..', ',', '!', '?', ':', ';', '-', '_', '/', '//', C(92), '(', ')', '[', ']', '{', '}', '<', '>', '"', "'", '`', '~', '^', '|', '+', '=', '&', '%', '*',
    '@', '#', '$', U(0xff20), U(0xff03), 'http://', 'https://', 'HTTP://', 'Https://', 'ftp://', 'www.', 'mailto:', 'http:/', 'https:',
    'example', 'twitter', 't', 'co', 'foo', 'bar-baz', 'a_b', 'x1', 'README', 'index', 'localhost', 'xn--', 'xn--p1ai', 'xn--80ak6aa92e',
    '.com', '.net', '.org', '.io', '.co', '.uk', '.co.uk', '.md', '.MD', '.Md', '.rs', '.py', '.js', '.ts', '.gov', '.edu', '.zip', '.mov', '.next', '.app', '.dev', '.ai', '.me', '.it', '.in', '.one', '.xyz', '.invalid', '.c', '.coma', '.comx', '.online', '.museum',
    '.music', '.kids', '.spa', '.amazon', '.mu', '.ki', '.sp', '.amaz', '.musical', '.spam',
    '.' + U(0x440, 0x444), '.' + U(0xd55c, 0xad6d), '.' + U(0x4e2d, 0x56fd), '.' + U(0x30a2, 0x30de, 0x30be, 0x30f3), '.' + U(0x4e9a, 0x9a6c, 0x900a), '.' + U(0x5d9, 0x5e9, 0x5e8, 0x5d0, 0x5dc),
    U(0x43f, 0x440, 0x438, 0x43c, 0x435, 0x440), U(0x4f8b, 0x3048), U(0x6f22), U(0x3042),
    't.co/', 't.co/abc', 't.co/' + rep('a', 41), '/path', '/a/b', '/a.b', '/a_(b)', '/(a)', '/((a))', '/a(b(c)d)e', '/@user/', '/@', '?q=1', '?a=b&c=d', '?', '?x', '#frag', '#', ':8080', ':80/', ':', rep('a', 63), rep('a', 64), rep('b', 30), rep('c', 61),
    U(0x1f600), U(0x1f468), U(0x1f469), U(0x1f467), U(0x1f466), U(0x200d), U(0x200d), U(0xfe0f), U(0xfe0e), U(0x1f3fb), U(0x1f3fd), U(0x1f1e8), U(0x1f1f4), U(0x1f1fa), U(0x1f1f6), U(0x20e3), '1', '#', '*',
    U(0x2764), U(0x2764, 0xfe0f), U(0x267e), U(0x267e, 0xfe0f), U(0xa9), U(0xae), U(0x2122), U(0x1f441), U(0x1f5e8), U(0x1f9d1), U(0x1f527), U(0x2640), U(0x2642), U(0x1f3f3, 0xfe0f), U(0x1f308), U(0x26a7), U(0x1f3f4), U(0xe0067), U(0xe007f),
    U(0x1faf7), U(0x1faf8), U(0x1faf0), U(0x1faf1), U(0x1f426), U(0x2b1b), U(0x1f525), U(0x1f642), U(0x2194), U(0x2195), U(0x1f6b6), U(0x27a1), U(0x1f46f), U(0x1f34b), U(0x1f7e9), U(0x26d3), U(0x1f4a5), U(0x1f9d2), U(0x1fae8), U(0x1fae9), U(0x1fa77), U(0x1fa89), U(0x1f344), U(0x1f7eb),
    U(0x301), U(0x308), 'e', U(0xe9), U(0x202a), U(0x202c), U(0x2066), U(0x2069), U(0x200e), U(0x200f), U(0x61c), U(0xfeff), U(0xfeff), U(0xfffe), U(0xffff), U(0xa0), U(0x3000), U(0x2028), U(0x3002), U(0xff0e), U(0xff61),
    U(0x10ff), U(0x1100), U(0x2000), U(0x200b), U(0x200c), U(0x200e), U(0x2010), U(0x201f), U(0x2020), U(0x2032), U(0x2037), U(0x2038), U(0x2013),
    C(0xd800), C(0xdc00), C(0xdbff), C(0xdfff), C(0), C(1), C(8), C(14), C(31), C(127),
    U(0x400), U(0x4ff), U(0xc0), U(0xd7), U(0xf7), U(0x24f), U(0x250), U(0x1e00), U(0x1eff), U(0x36f), U(0x370)
  ];
  var DENSE = ['a', 'b', 'c', 'x', '1', '.', '.', '.', '_', '_', '-', '-', U(0x3042), U(0x6f22), U(0x3002), 'com', 'co', 'md', 'MD', 'music', 'kids', 'spa', 'uk', 'io', 'xn--', 'xn--p1ai', U(0x440, 0x444), 'http://', 'https://', 'www', '/', '/p', '?q=1', ':', '@', '#', '$', ' ', U(0x1f600), U(0x200d), U(0xfe0f), 'e' + U(0x301), 'comx', 'com-', 'com+', 'com@', '"', U(0xff0e), '..', '._', '_.', '-.', '.-', rep('a', 62), rep('a', 63), U(0xfeff), C(1), C(127)];
  var SHAPE = {
    before: ['', ' ', 'a', '9', '@', '#', '$', '-', '_', '.', '/', '(', '"', U(0x3042), ':', U(0xff20), U(0x202a), C(10), 'x ', '=', '+', U(0xfeff), C(1)],
    protocol: ['', '', 'http://', 'https://', 'HTTPS://', 'ftp://', 'www.', 'http://www.'],
    host: ['example', 'sub.example', 'a-b', 'a_b', 'sub_x.example', '-a', 'a-', 'a..b', '', 'EXAMPLE', 'README', 'notes', U(0x4f8b, 0x3048), 'x.' + U(0x4f8b), rep('a', 63), rep('a', 64), rep('a', 62) + C(1), rep('a', 62) + C(127), 'a' + C(1) + 'b', 'a' + U(0xfeff) + 'b', U(0xfeff) + 'a', 't', '1', '1.2.3', 'xn--abc', U(0xe9) + 'cole', 'a' + U(0x1f600)],
    ending: ['.com', '.co', '.COM', '.md', '.MD', '.md.com', '.com.md', '.gov', '.next', '.coma', '.c', '.invalid', '.co.uk', '.music', '.kids', '.spa', '.amazon', '.SPA', '.' + U(0x440, 0x444), '.' + U(0x30a2, 0x30de, 0x30be, 0x30f3), '.' + U(0x4e9a, 0x9a6c, 0x900a), '.' + U(0x5d9, 0x5e9, 0x5e8, 0x5d0, 0x5dc), '.xn--p1ai', '.com.', '.com-', '.com+', '.com@', '.com_', '.md/', ''],
    port: ['', ':80', ':'],
    path: ['', '/', '/a', '/a.', '/a.b', '/a,b', '/a_(b)', '/a(b', '/a)', '/@u/', '/@u', '/' + U(0x3042), '/a!', '/a-', '/a+', '/a~', '/%20', '/a:b', "/a'b", '/a*', '/a;', '/' + U(0x444), '/x.md'],
    query: ['', '?', '?a', '?a=b', '?a=b&', '?a=b.', '?a=(b)', '?a=' + U(0x3042), '#f', '#', '?a#b!'],
    after: ['', '.', ',', '!', '?', ')', ':', ';', '"', "'", U(0x2026), 'x', ' y', '/', '@z', U(0x3002), U(0x202c), U(0xfeff), C(1)]
  };
  var out = [];
  var link = function () { return pick(SHAPE.before) + pick(SHAPE.protocol) + pick(SHAPE.host) + pick(SHAPE.ending) + pick(SHAPE.port) + pick(SHAPE.path) + pick(SHAPE.query) + pick(SHAPE.after); };
  var n, k, s;
  for (n = 0; n < 150000; n++) {
    s = '';
    for (k = 1 + Math.floor(next() * (next() < 0.2 ? 24 : 9)); k > 0; k--) s += pick(FRAG);
    out.push(s);
  }
  for (n = 0; n < 80000; n++) {
    s = '';
    for (k = 2 + Math.floor(next() * (next() < 0.15 ? 60 : 14)); k > 0; k--) s += pick(DENSE);
    out.push(s);
  }
  for (n = 0; n < 170000; n++) out.push(next() < 0.25 ? link() + ' ' + link() : link());
  if (part === 0) {
    for (var cp = 0; cp <= 0x1ffff; cp++) out.push(cp >= 0xd800 && cp <= 0xdfff ? C(cp) : U(cp));
  }
  return out;
}
