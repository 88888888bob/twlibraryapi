var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined")
    return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/bcryptjs/dist/bcrypt.js
var require_bcrypt = __commonJS({
  "node_modules/bcryptjs/dist/bcrypt.js"(exports, module) {
    (function(global, factory) {
      if (typeof define === "function" && define["amd"])
        define([], factory);
      else if (typeof __require === "function" && typeof module === "object" && module && module["exports"])
        module["exports"] = factory();
      else
        (global["dcodeIO"] = global["dcodeIO"] || {})["bcrypt"] = factory();
    })(exports, function() {
      "use strict";
      var bcrypt2 = {};
      var randomFallback = null;
      function random(len) {
        if (typeof module !== "undefined" && module && module["exports"])
          try {
            return __require("crypto")["randomBytes"](len);
          } catch (e) {
          }
        try {
          var a;
          (self["crypto"] || self["msCrypto"])["getRandomValues"](a = new Uint32Array(len));
          return Array.prototype.slice.call(a);
        } catch (e) {
        }
        if (!randomFallback)
          throw Error("Neither WebCryptoAPI nor a crypto module is available. Use bcrypt.setRandomFallback to set an alternative");
        return randomFallback(len);
      }
      var randomAvailable = false;
      try {
        random(1);
        randomAvailable = true;
      } catch (e) {
      }
      randomFallback = null;
      bcrypt2.setRandomFallback = function(random2) {
        randomFallback = random2;
      };
      bcrypt2.genSaltSync = function(rounds, seed_length) {
        rounds = rounds || GENSALT_DEFAULT_LOG2_ROUNDS;
        if (typeof rounds !== "number")
          throw Error("Illegal arguments: " + typeof rounds + ", " + typeof seed_length);
        if (rounds < 4)
          rounds = 4;
        else if (rounds > 31)
          rounds = 31;
        var salt = [];
        salt.push("$2a$");
        if (rounds < 10)
          salt.push("0");
        salt.push(rounds.toString());
        salt.push("$");
        salt.push(base64_encode(random(BCRYPT_SALT_LEN), BCRYPT_SALT_LEN));
        return salt.join("");
      };
      bcrypt2.genSalt = function(rounds, seed_length, callback) {
        if (typeof seed_length === "function")
          callback = seed_length, seed_length = void 0;
        if (typeof rounds === "function")
          callback = rounds, rounds = void 0;
        if (typeof rounds === "undefined")
          rounds = GENSALT_DEFAULT_LOG2_ROUNDS;
        else if (typeof rounds !== "number")
          throw Error("illegal arguments: " + typeof rounds);
        function _async(callback2) {
          nextTick(function() {
            try {
              callback2(null, bcrypt2.genSaltSync(rounds));
            } catch (err) {
              callback2(err);
            }
          });
        }
        if (callback) {
          if (typeof callback !== "function")
            throw Error("Illegal callback: " + typeof callback);
          _async(callback);
        } else
          return new Promise(function(resolve, reject) {
            _async(function(err, res) {
              if (err) {
                reject(err);
                return;
              }
              resolve(res);
            });
          });
      };
      bcrypt2.hashSync = function(s, salt) {
        if (typeof salt === "undefined")
          salt = GENSALT_DEFAULT_LOG2_ROUNDS;
        if (typeof salt === "number")
          salt = bcrypt2.genSaltSync(salt);
        if (typeof s !== "string" || typeof salt !== "string")
          throw Error("Illegal arguments: " + typeof s + ", " + typeof salt);
        return _hash(s, salt);
      };
      bcrypt2.hash = function(s, salt, callback, progressCallback) {
        function _async(callback2) {
          if (typeof s === "string" && typeof salt === "number")
            bcrypt2.genSalt(salt, function(err, salt2) {
              _hash(s, salt2, callback2, progressCallback);
            });
          else if (typeof s === "string" && typeof salt === "string")
            _hash(s, salt, callback2, progressCallback);
          else
            nextTick(callback2.bind(this, Error("Illegal arguments: " + typeof s + ", " + typeof salt)));
        }
        if (callback) {
          if (typeof callback !== "function")
            throw Error("Illegal callback: " + typeof callback);
          _async(callback);
        } else
          return new Promise(function(resolve, reject) {
            _async(function(err, res) {
              if (err) {
                reject(err);
                return;
              }
              resolve(res);
            });
          });
      };
      function safeStringCompare(known, unknown) {
        var right = 0, wrong = 0;
        for (var i = 0, k = known.length; i < k; ++i) {
          if (known.charCodeAt(i) === unknown.charCodeAt(i))
            ++right;
          else
            ++wrong;
        }
        if (right < 0)
          return false;
        return wrong === 0;
      }
      bcrypt2.compareSync = function(s, hash2) {
        if (typeof s !== "string" || typeof hash2 !== "string")
          throw Error("Illegal arguments: " + typeof s + ", " + typeof hash2);
        if (hash2.length !== 60)
          return false;
        return safeStringCompare(bcrypt2.hashSync(s, hash2.substr(0, hash2.length - 31)), hash2);
      };
      bcrypt2.compare = function(s, hash2, callback, progressCallback) {
        function _async(callback2) {
          if (typeof s !== "string" || typeof hash2 !== "string") {
            nextTick(callback2.bind(this, Error("Illegal arguments: " + typeof s + ", " + typeof hash2)));
            return;
          }
          if (hash2.length !== 60) {
            nextTick(callback2.bind(this, null, false));
            return;
          }
          bcrypt2.hash(s, hash2.substr(0, 29), function(err, comp) {
            if (err)
              callback2(err);
            else
              callback2(null, safeStringCompare(comp, hash2));
          }, progressCallback);
        }
        if (callback) {
          if (typeof callback !== "function")
            throw Error("Illegal callback: " + typeof callback);
          _async(callback);
        } else
          return new Promise(function(resolve, reject) {
            _async(function(err, res) {
              if (err) {
                reject(err);
                return;
              }
              resolve(res);
            });
          });
      };
      bcrypt2.getRounds = function(hash2) {
        if (typeof hash2 !== "string")
          throw Error("Illegal arguments: " + typeof hash2);
        return parseInt(hash2.split("$")[2], 10);
      };
      bcrypt2.getSalt = function(hash2) {
        if (typeof hash2 !== "string")
          throw Error("Illegal arguments: " + typeof hash2);
        if (hash2.length !== 60)
          throw Error("Illegal hash length: " + hash2.length + " != 60");
        return hash2.substring(0, 29);
      };
      var nextTick = typeof process !== "undefined" && process && typeof process.nextTick === "function" ? typeof setImmediate === "function" ? setImmediate : process.nextTick : setTimeout;
      function stringToBytes(str) {
        var out = [], i = 0;
        utfx.encodeUTF16toUTF8(function() {
          if (i >= str.length)
            return null;
          return str.charCodeAt(i++);
        }, function(b) {
          out.push(b);
        });
        return out;
      }
      var BASE64_CODE = "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split("");
      var BASE64_INDEX = [
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        0,
        1,
        54,
        55,
        56,
        57,
        58,
        59,
        60,
        61,
        62,
        63,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16,
        17,
        18,
        19,
        20,
        21,
        22,
        23,
        24,
        25,
        26,
        27,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        28,
        29,
        30,
        31,
        32,
        33,
        34,
        35,
        36,
        37,
        38,
        39,
        40,
        41,
        42,
        43,
        44,
        45,
        46,
        47,
        48,
        49,
        50,
        51,
        52,
        53,
        -1,
        -1,
        -1,
        -1,
        -1
      ];
      var stringFromCharCode = String.fromCharCode;
      function base64_encode(b, len) {
        var off = 0, rs = [], c1, c2;
        if (len <= 0 || len > b.length)
          throw Error("Illegal len: " + len);
        while (off < len) {
          c1 = b[off++] & 255;
          rs.push(BASE64_CODE[c1 >> 2 & 63]);
          c1 = (c1 & 3) << 4;
          if (off >= len) {
            rs.push(BASE64_CODE[c1 & 63]);
            break;
          }
          c2 = b[off++] & 255;
          c1 |= c2 >> 4 & 15;
          rs.push(BASE64_CODE[c1 & 63]);
          c1 = (c2 & 15) << 2;
          if (off >= len) {
            rs.push(BASE64_CODE[c1 & 63]);
            break;
          }
          c2 = b[off++] & 255;
          c1 |= c2 >> 6 & 3;
          rs.push(BASE64_CODE[c1 & 63]);
          rs.push(BASE64_CODE[c2 & 63]);
        }
        return rs.join("");
      }
      function base64_decode(s, len) {
        var off = 0, slen = s.length, olen = 0, rs = [], c1, c2, c3, c4, o, code;
        if (len <= 0)
          throw Error("Illegal len: " + len);
        while (off < slen - 1 && olen < len) {
          code = s.charCodeAt(off++);
          c1 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
          code = s.charCodeAt(off++);
          c2 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
          if (c1 == -1 || c2 == -1)
            break;
          o = c1 << 2 >>> 0;
          o |= (c2 & 48) >> 4;
          rs.push(stringFromCharCode(o));
          if (++olen >= len || off >= slen)
            break;
          code = s.charCodeAt(off++);
          c3 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
          if (c3 == -1)
            break;
          o = (c2 & 15) << 4 >>> 0;
          o |= (c3 & 60) >> 2;
          rs.push(stringFromCharCode(o));
          if (++olen >= len || off >= slen)
            break;
          code = s.charCodeAt(off++);
          c4 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
          o = (c3 & 3) << 6 >>> 0;
          o |= c4;
          rs.push(stringFromCharCode(o));
          ++olen;
        }
        var res = [];
        for (off = 0; off < olen; off++)
          res.push(rs[off].charCodeAt(0));
        return res;
      }
      var utfx = function() {
        "use strict";
        var utfx2 = {};
        utfx2.MAX_CODEPOINT = 1114111;
        utfx2.encodeUTF8 = function(src, dst) {
          var cp = null;
          if (typeof src === "number")
            cp = src, src = function() {
              return null;
            };
          while (cp !== null || (cp = src()) !== null) {
            if (cp < 128)
              dst(cp & 127);
            else if (cp < 2048)
              dst(cp >> 6 & 31 | 192), dst(cp & 63 | 128);
            else if (cp < 65536)
              dst(cp >> 12 & 15 | 224), dst(cp >> 6 & 63 | 128), dst(cp & 63 | 128);
            else
              dst(cp >> 18 & 7 | 240), dst(cp >> 12 & 63 | 128), dst(cp >> 6 & 63 | 128), dst(cp & 63 | 128);
            cp = null;
          }
        };
        utfx2.decodeUTF8 = function(src, dst) {
          var a, b, c, d, fail = function(b2) {
            b2 = b2.slice(0, b2.indexOf(null));
            var err = Error(b2.toString());
            err.name = "TruncatedError";
            err["bytes"] = b2;
            throw err;
          };
          while ((a = src()) !== null) {
            if ((a & 128) === 0)
              dst(a);
            else if ((a & 224) === 192)
              (b = src()) === null && fail([a, b]), dst((a & 31) << 6 | b & 63);
            else if ((a & 240) === 224)
              ((b = src()) === null || (c = src()) === null) && fail([a, b, c]), dst((a & 15) << 12 | (b & 63) << 6 | c & 63);
            else if ((a & 248) === 240)
              ((b = src()) === null || (c = src()) === null || (d = src()) === null) && fail([a, b, c, d]), dst((a & 7) << 18 | (b & 63) << 12 | (c & 63) << 6 | d & 63);
            else
              throw RangeError("Illegal starting byte: " + a);
          }
        };
        utfx2.UTF16toUTF8 = function(src, dst) {
          var c1, c2 = null;
          while (true) {
            if ((c1 = c2 !== null ? c2 : src()) === null)
              break;
            if (c1 >= 55296 && c1 <= 57343) {
              if ((c2 = src()) !== null) {
                if (c2 >= 56320 && c2 <= 57343) {
                  dst((c1 - 55296) * 1024 + c2 - 56320 + 65536);
                  c2 = null;
                  continue;
                }
              }
            }
            dst(c1);
          }
          if (c2 !== null)
            dst(c2);
        };
        utfx2.UTF8toUTF16 = function(src, dst) {
          var cp = null;
          if (typeof src === "number")
            cp = src, src = function() {
              return null;
            };
          while (cp !== null || (cp = src()) !== null) {
            if (cp <= 65535)
              dst(cp);
            else
              cp -= 65536, dst((cp >> 10) + 55296), dst(cp % 1024 + 56320);
            cp = null;
          }
        };
        utfx2.encodeUTF16toUTF8 = function(src, dst) {
          utfx2.UTF16toUTF8(src, function(cp) {
            utfx2.encodeUTF8(cp, dst);
          });
        };
        utfx2.decodeUTF8toUTF16 = function(src, dst) {
          utfx2.decodeUTF8(src, function(cp) {
            utfx2.UTF8toUTF16(cp, dst);
          });
        };
        utfx2.calculateCodePoint = function(cp) {
          return cp < 128 ? 1 : cp < 2048 ? 2 : cp < 65536 ? 3 : 4;
        };
        utfx2.calculateUTF8 = function(src) {
          var cp, l = 0;
          while ((cp = src()) !== null)
            l += utfx2.calculateCodePoint(cp);
          return l;
        };
        utfx2.calculateUTF16asUTF8 = function(src) {
          var n = 0, l = 0;
          utfx2.UTF16toUTF8(src, function(cp) {
            ++n;
            l += utfx2.calculateCodePoint(cp);
          });
          return [n, l];
        };
        return utfx2;
      }();
      Date.now = Date.now || function() {
        return +/* @__PURE__ */ new Date();
      };
      var BCRYPT_SALT_LEN = 16;
      var GENSALT_DEFAULT_LOG2_ROUNDS = 10;
      var BLOWFISH_NUM_ROUNDS = 16;
      var MAX_EXECUTION_TIME = 100;
      var P_ORIG = [
        608135816,
        2242054355,
        320440878,
        57701188,
        2752067618,
        698298832,
        137296536,
        3964562569,
        1160258022,
        953160567,
        3193202383,
        887688300,
        3232508343,
        3380367581,
        1065670069,
        3041331479,
        2450970073,
        2306472731
      ];
      var S_ORIG = [
        3509652390,
        2564797868,
        805139163,
        3491422135,
        3101798381,
        1780907670,
        3128725573,
        4046225305,
        614570311,
        3012652279,
        134345442,
        2240740374,
        1667834072,
        1901547113,
        2757295779,
        4103290238,
        227898511,
        1921955416,
        1904987480,
        2182433518,
        2069144605,
        3260701109,
        2620446009,
        720527379,
        3318853667,
        677414384,
        3393288472,
        3101374703,
        2390351024,
        1614419982,
        1822297739,
        2954791486,
        3608508353,
        3174124327,
        2024746970,
        1432378464,
        3864339955,
        2857741204,
        1464375394,
        1676153920,
        1439316330,
        715854006,
        3033291828,
        289532110,
        2706671279,
        2087905683,
        3018724369,
        1668267050,
        732546397,
        1947742710,
        3462151702,
        2609353502,
        2950085171,
        1814351708,
        2050118529,
        680887927,
        999245976,
        1800124847,
        3300911131,
        1713906067,
        1641548236,
        4213287313,
        1216130144,
        1575780402,
        4018429277,
        3917837745,
        3693486850,
        3949271944,
        596196993,
        3549867205,
        258830323,
        2213823033,
        772490370,
        2760122372,
        1774776394,
        2652871518,
        566650946,
        4142492826,
        1728879713,
        2882767088,
        1783734482,
        3629395816,
        2517608232,
        2874225571,
        1861159788,
        326777828,
        3124490320,
        2130389656,
        2716951837,
        967770486,
        1724537150,
        2185432712,
        2364442137,
        1164943284,
        2105845187,
        998989502,
        3765401048,
        2244026483,
        1075463327,
        1455516326,
        1322494562,
        910128902,
        469688178,
        1117454909,
        936433444,
        3490320968,
        3675253459,
        1240580251,
        122909385,
        2157517691,
        634681816,
        4142456567,
        3825094682,
        3061402683,
        2540495037,
        79693498,
        3249098678,
        1084186820,
        1583128258,
        426386531,
        1761308591,
        1047286709,
        322548459,
        995290223,
        1845252383,
        2603652396,
        3431023940,
        2942221577,
        3202600964,
        3727903485,
        1712269319,
        422464435,
        3234572375,
        1170764815,
        3523960633,
        3117677531,
        1434042557,
        442511882,
        3600875718,
        1076654713,
        1738483198,
        4213154764,
        2393238008,
        3677496056,
        1014306527,
        4251020053,
        793779912,
        2902807211,
        842905082,
        4246964064,
        1395751752,
        1040244610,
        2656851899,
        3396308128,
        445077038,
        3742853595,
        3577915638,
        679411651,
        2892444358,
        2354009459,
        1767581616,
        3150600392,
        3791627101,
        3102740896,
        284835224,
        4246832056,
        1258075500,
        768725851,
        2589189241,
        3069724005,
        3532540348,
        1274779536,
        3789419226,
        2764799539,
        1660621633,
        3471099624,
        4011903706,
        913787905,
        3497959166,
        737222580,
        2514213453,
        2928710040,
        3937242737,
        1804850592,
        3499020752,
        2949064160,
        2386320175,
        2390070455,
        2415321851,
        4061277028,
        2290661394,
        2416832540,
        1336762016,
        1754252060,
        3520065937,
        3014181293,
        791618072,
        3188594551,
        3933548030,
        2332172193,
        3852520463,
        3043980520,
        413987798,
        3465142937,
        3030929376,
        4245938359,
        2093235073,
        3534596313,
        375366246,
        2157278981,
        2479649556,
        555357303,
        3870105701,
        2008414854,
        3344188149,
        4221384143,
        3956125452,
        2067696032,
        3594591187,
        2921233993,
        2428461,
        544322398,
        577241275,
        1471733935,
        610547355,
        4027169054,
        1432588573,
        1507829418,
        2025931657,
        3646575487,
        545086370,
        48609733,
        2200306550,
        1653985193,
        298326376,
        1316178497,
        3007786442,
        2064951626,
        458293330,
        2589141269,
        3591329599,
        3164325604,
        727753846,
        2179363840,
        146436021,
        1461446943,
        4069977195,
        705550613,
        3059967265,
        3887724982,
        4281599278,
        3313849956,
        1404054877,
        2845806497,
        146425753,
        1854211946,
        1266315497,
        3048417604,
        3681880366,
        3289982499,
        290971e4,
        1235738493,
        2632868024,
        2414719590,
        3970600049,
        1771706367,
        1449415276,
        3266420449,
        422970021,
        1963543593,
        2690192192,
        3826793022,
        1062508698,
        1531092325,
        1804592342,
        2583117782,
        2714934279,
        4024971509,
        1294809318,
        4028980673,
        1289560198,
        2221992742,
        1669523910,
        35572830,
        157838143,
        1052438473,
        1016535060,
        1802137761,
        1753167236,
        1386275462,
        3080475397,
        2857371447,
        1040679964,
        2145300060,
        2390574316,
        1461121720,
        2956646967,
        4031777805,
        4028374788,
        33600511,
        2920084762,
        1018524850,
        629373528,
        3691585981,
        3515945977,
        2091462646,
        2486323059,
        586499841,
        988145025,
        935516892,
        3367335476,
        2599673255,
        2839830854,
        265290510,
        3972581182,
        2759138881,
        3795373465,
        1005194799,
        847297441,
        406762289,
        1314163512,
        1332590856,
        1866599683,
        4127851711,
        750260880,
        613907577,
        1450815602,
        3165620655,
        3734664991,
        3650291728,
        3012275730,
        3704569646,
        1427272223,
        778793252,
        1343938022,
        2676280711,
        2052605720,
        1946737175,
        3164576444,
        3914038668,
        3967478842,
        3682934266,
        1661551462,
        3294938066,
        4011595847,
        840292616,
        3712170807,
        616741398,
        312560963,
        711312465,
        1351876610,
        322626781,
        1910503582,
        271666773,
        2175563734,
        1594956187,
        70604529,
        3617834859,
        1007753275,
        1495573769,
        4069517037,
        2549218298,
        2663038764,
        504708206,
        2263041392,
        3941167025,
        2249088522,
        1514023603,
        1998579484,
        1312622330,
        694541497,
        2582060303,
        2151582166,
        1382467621,
        776784248,
        2618340202,
        3323268794,
        2497899128,
        2784771155,
        503983604,
        4076293799,
        907881277,
        423175695,
        432175456,
        1378068232,
        4145222326,
        3954048622,
        3938656102,
        3820766613,
        2793130115,
        2977904593,
        26017576,
        3274890735,
        3194772133,
        1700274565,
        1756076034,
        4006520079,
        3677328699,
        720338349,
        1533947780,
        354530856,
        688349552,
        3973924725,
        1637815568,
        332179504,
        3949051286,
        53804574,
        2852348879,
        3044236432,
        1282449977,
        3583942155,
        3416972820,
        4006381244,
        1617046695,
        2628476075,
        3002303598,
        1686838959,
        431878346,
        2686675385,
        1700445008,
        1080580658,
        1009431731,
        832498133,
        3223435511,
        2605976345,
        2271191193,
        2516031870,
        1648197032,
        4164389018,
        2548247927,
        300782431,
        375919233,
        238389289,
        3353747414,
        2531188641,
        2019080857,
        1475708069,
        455242339,
        2609103871,
        448939670,
        3451063019,
        1395535956,
        2413381860,
        1841049896,
        1491858159,
        885456874,
        4264095073,
        4001119347,
        1565136089,
        3898914787,
        1108368660,
        540939232,
        1173283510,
        2745871338,
        3681308437,
        4207628240,
        3343053890,
        4016749493,
        1699691293,
        1103962373,
        3625875870,
        2256883143,
        3830138730,
        1031889488,
        3479347698,
        1535977030,
        4236805024,
        3251091107,
        2132092099,
        1774941330,
        1199868427,
        1452454533,
        157007616,
        2904115357,
        342012276,
        595725824,
        1480756522,
        206960106,
        497939518,
        591360097,
        863170706,
        2375253569,
        3596610801,
        1814182875,
        2094937945,
        3421402208,
        1082520231,
        3463918190,
        2785509508,
        435703966,
        3908032597,
        1641649973,
        2842273706,
        3305899714,
        1510255612,
        2148256476,
        2655287854,
        3276092548,
        4258621189,
        236887753,
        3681803219,
        274041037,
        1734335097,
        3815195456,
        3317970021,
        1899903192,
        1026095262,
        4050517792,
        356393447,
        2410691914,
        3873677099,
        3682840055,
        3913112168,
        2491498743,
        4132185628,
        2489919796,
        1091903735,
        1979897079,
        3170134830,
        3567386728,
        3557303409,
        857797738,
        1136121015,
        1342202287,
        507115054,
        2535736646,
        337727348,
        3213592640,
        1301675037,
        2528481711,
        1895095763,
        1721773893,
        3216771564,
        62756741,
        2142006736,
        835421444,
        2531993523,
        1442658625,
        3659876326,
        2882144922,
        676362277,
        1392781812,
        170690266,
        3921047035,
        1759253602,
        3611846912,
        1745797284,
        664899054,
        1329594018,
        3901205900,
        3045908486,
        2062866102,
        2865634940,
        3543621612,
        3464012697,
        1080764994,
        553557557,
        3656615353,
        3996768171,
        991055499,
        499776247,
        1265440854,
        648242737,
        3940784050,
        980351604,
        3713745714,
        1749149687,
        3396870395,
        4211799374,
        3640570775,
        1161844396,
        3125318951,
        1431517754,
        545492359,
        4268468663,
        3499529547,
        1437099964,
        2702547544,
        3433638243,
        2581715763,
        2787789398,
        1060185593,
        1593081372,
        2418618748,
        4260947970,
        69676912,
        2159744348,
        86519011,
        2512459080,
        3838209314,
        1220612927,
        3339683548,
        133810670,
        1090789135,
        1078426020,
        1569222167,
        845107691,
        3583754449,
        4072456591,
        1091646820,
        628848692,
        1613405280,
        3757631651,
        526609435,
        236106946,
        48312990,
        2942717905,
        3402727701,
        1797494240,
        859738849,
        992217954,
        4005476642,
        2243076622,
        3870952857,
        3732016268,
        765654824,
        3490871365,
        2511836413,
        1685915746,
        3888969200,
        1414112111,
        2273134842,
        3281911079,
        4080962846,
        172450625,
        2569994100,
        980381355,
        4109958455,
        2819808352,
        2716589560,
        2568741196,
        3681446669,
        3329971472,
        1835478071,
        660984891,
        3704678404,
        4045999559,
        3422617507,
        3040415634,
        1762651403,
        1719377915,
        3470491036,
        2693910283,
        3642056355,
        3138596744,
        1364962596,
        2073328063,
        1983633131,
        926494387,
        3423689081,
        2150032023,
        4096667949,
        1749200295,
        3328846651,
        309677260,
        2016342300,
        1779581495,
        3079819751,
        111262694,
        1274766160,
        443224088,
        298511866,
        1025883608,
        3806446537,
        1145181785,
        168956806,
        3641502830,
        3584813610,
        1689216846,
        3666258015,
        3200248200,
        1692713982,
        2646376535,
        4042768518,
        1618508792,
        1610833997,
        3523052358,
        4130873264,
        2001055236,
        3610705100,
        2202168115,
        4028541809,
        2961195399,
        1006657119,
        2006996926,
        3186142756,
        1430667929,
        3210227297,
        1314452623,
        4074634658,
        4101304120,
        2273951170,
        1399257539,
        3367210612,
        3027628629,
        1190975929,
        2062231137,
        2333990788,
        2221543033,
        2438960610,
        1181637006,
        548689776,
        2362791313,
        3372408396,
        3104550113,
        3145860560,
        296247880,
        1970579870,
        3078560182,
        3769228297,
        1714227617,
        3291629107,
        3898220290,
        166772364,
        1251581989,
        493813264,
        448347421,
        195405023,
        2709975567,
        677966185,
        3703036547,
        1463355134,
        2715995803,
        1338867538,
        1343315457,
        2802222074,
        2684532164,
        233230375,
        2599980071,
        2000651841,
        3277868038,
        1638401717,
        4028070440,
        3237316320,
        6314154,
        819756386,
        300326615,
        590932579,
        1405279636,
        3267499572,
        3150704214,
        2428286686,
        3959192993,
        3461946742,
        1862657033,
        1266418056,
        963775037,
        2089974820,
        2263052895,
        1917689273,
        448879540,
        3550394620,
        3981727096,
        150775221,
        3627908307,
        1303187396,
        508620638,
        2975983352,
        2726630617,
        1817252668,
        1876281319,
        1457606340,
        908771278,
        3720792119,
        3617206836,
        2455994898,
        1729034894,
        1080033504,
        976866871,
        3556439503,
        2881648439,
        1522871579,
        1555064734,
        1336096578,
        3548522304,
        2579274686,
        3574697629,
        3205460757,
        3593280638,
        3338716283,
        3079412587,
        564236357,
        2993598910,
        1781952180,
        1464380207,
        3163844217,
        3332601554,
        1699332808,
        1393555694,
        1183702653,
        3581086237,
        1288719814,
        691649499,
        2847557200,
        2895455976,
        3193889540,
        2717570544,
        1781354906,
        1676643554,
        2592534050,
        3230253752,
        1126444790,
        2770207658,
        2633158820,
        2210423226,
        2615765581,
        2414155088,
        3127139286,
        673620729,
        2805611233,
        1269405062,
        4015350505,
        3341807571,
        4149409754,
        1057255273,
        2012875353,
        2162469141,
        2276492801,
        2601117357,
        993977747,
        3918593370,
        2654263191,
        753973209,
        36408145,
        2530585658,
        25011837,
        3520020182,
        2088578344,
        530523599,
        2918365339,
        1524020338,
        1518925132,
        3760827505,
        3759777254,
        1202760957,
        3985898139,
        3906192525,
        674977740,
        4174734889,
        2031300136,
        2019492241,
        3983892565,
        4153806404,
        3822280332,
        352677332,
        2297720250,
        60907813,
        90501309,
        3286998549,
        1016092578,
        2535922412,
        2839152426,
        457141659,
        509813237,
        4120667899,
        652014361,
        1966332200,
        2975202805,
        55981186,
        2327461051,
        676427537,
        3255491064,
        2882294119,
        3433927263,
        1307055953,
        942726286,
        933058658,
        2468411793,
        3933900994,
        4215176142,
        1361170020,
        2001714738,
        2830558078,
        3274259782,
        1222529897,
        1679025792,
        2729314320,
        3714953764,
        1770335741,
        151462246,
        3013232138,
        1682292957,
        1483529935,
        471910574,
        1539241949,
        458788160,
        3436315007,
        1807016891,
        3718408830,
        978976581,
        1043663428,
        3165965781,
        1927990952,
        4200891579,
        2372276910,
        3208408903,
        3533431907,
        1412390302,
        2931980059,
        4132332400,
        1947078029,
        3881505623,
        4168226417,
        2941484381,
        1077988104,
        1320477388,
        886195818,
        18198404,
        3786409e3,
        2509781533,
        112762804,
        3463356488,
        1866414978,
        891333506,
        18488651,
        661792760,
        1628790961,
        3885187036,
        3141171499,
        876946877,
        2693282273,
        1372485963,
        791857591,
        2686433993,
        3759982718,
        3167212022,
        3472953795,
        2716379847,
        445679433,
        3561995674,
        3504004811,
        3574258232,
        54117162,
        3331405415,
        2381918588,
        3769707343,
        4154350007,
        1140177722,
        4074052095,
        668550556,
        3214352940,
        367459370,
        261225585,
        2610173221,
        4209349473,
        3468074219,
        3265815641,
        314222801,
        3066103646,
        3808782860,
        282218597,
        3406013506,
        3773591054,
        379116347,
        1285071038,
        846784868,
        2669647154,
        3771962079,
        3550491691,
        2305946142,
        453669953,
        1268987020,
        3317592352,
        3279303384,
        3744833421,
        2610507566,
        3859509063,
        266596637,
        3847019092,
        517658769,
        3462560207,
        3443424879,
        370717030,
        4247526661,
        2224018117,
        4143653529,
        4112773975,
        2788324899,
        2477274417,
        1456262402,
        2901442914,
        1517677493,
        1846949527,
        2295493580,
        3734397586,
        2176403920,
        1280348187,
        1908823572,
        3871786941,
        846861322,
        1172426758,
        3287448474,
        3383383037,
        1655181056,
        3139813346,
        901632758,
        1897031941,
        2986607138,
        3066810236,
        3447102507,
        1393639104,
        373351379,
        950779232,
        625454576,
        3124240540,
        4148612726,
        2007998917,
        544563296,
        2244738638,
        2330496472,
        2058025392,
        1291430526,
        424198748,
        50039436,
        29584100,
        3605783033,
        2429876329,
        2791104160,
        1057563949,
        3255363231,
        3075367218,
        3463963227,
        1469046755,
        985887462
      ];
      var C_ORIG = [
        1332899944,
        1700884034,
        1701343084,
        1684370003,
        1668446532,
        1869963892
      ];
      function _encipher(lr, off, P, S) {
        var n, l = lr[off], r = lr[off + 1];
        l ^= P[0];
        n = S[l >>> 24];
        n += S[256 | l >> 16 & 255];
        n ^= S[512 | l >> 8 & 255];
        n += S[768 | l & 255];
        r ^= n ^ P[1];
        n = S[r >>> 24];
        n += S[256 | r >> 16 & 255];
        n ^= S[512 | r >> 8 & 255];
        n += S[768 | r & 255];
        l ^= n ^ P[2];
        n = S[l >>> 24];
        n += S[256 | l >> 16 & 255];
        n ^= S[512 | l >> 8 & 255];
        n += S[768 | l & 255];
        r ^= n ^ P[3];
        n = S[r >>> 24];
        n += S[256 | r >> 16 & 255];
        n ^= S[512 | r >> 8 & 255];
        n += S[768 | r & 255];
        l ^= n ^ P[4];
        n = S[l >>> 24];
        n += S[256 | l >> 16 & 255];
        n ^= S[512 | l >> 8 & 255];
        n += S[768 | l & 255];
        r ^= n ^ P[5];
        n = S[r >>> 24];
        n += S[256 | r >> 16 & 255];
        n ^= S[512 | r >> 8 & 255];
        n += S[768 | r & 255];
        l ^= n ^ P[6];
        n = S[l >>> 24];
        n += S[256 | l >> 16 & 255];
        n ^= S[512 | l >> 8 & 255];
        n += S[768 | l & 255];
        r ^= n ^ P[7];
        n = S[r >>> 24];
        n += S[256 | r >> 16 & 255];
        n ^= S[512 | r >> 8 & 255];
        n += S[768 | r & 255];
        l ^= n ^ P[8];
        n = S[l >>> 24];
        n += S[256 | l >> 16 & 255];
        n ^= S[512 | l >> 8 & 255];
        n += S[768 | l & 255];
        r ^= n ^ P[9];
        n = S[r >>> 24];
        n += S[256 | r >> 16 & 255];
        n ^= S[512 | r >> 8 & 255];
        n += S[768 | r & 255];
        l ^= n ^ P[10];
        n = S[l >>> 24];
        n += S[256 | l >> 16 & 255];
        n ^= S[512 | l >> 8 & 255];
        n += S[768 | l & 255];
        r ^= n ^ P[11];
        n = S[r >>> 24];
        n += S[256 | r >> 16 & 255];
        n ^= S[512 | r >> 8 & 255];
        n += S[768 | r & 255];
        l ^= n ^ P[12];
        n = S[l >>> 24];
        n += S[256 | l >> 16 & 255];
        n ^= S[512 | l >> 8 & 255];
        n += S[768 | l & 255];
        r ^= n ^ P[13];
        n = S[r >>> 24];
        n += S[256 | r >> 16 & 255];
        n ^= S[512 | r >> 8 & 255];
        n += S[768 | r & 255];
        l ^= n ^ P[14];
        n = S[l >>> 24];
        n += S[256 | l >> 16 & 255];
        n ^= S[512 | l >> 8 & 255];
        n += S[768 | l & 255];
        r ^= n ^ P[15];
        n = S[r >>> 24];
        n += S[256 | r >> 16 & 255];
        n ^= S[512 | r >> 8 & 255];
        n += S[768 | r & 255];
        l ^= n ^ P[16];
        lr[off] = r ^ P[BLOWFISH_NUM_ROUNDS + 1];
        lr[off + 1] = l;
        return lr;
      }
      function _streamtoword(data, offp) {
        for (var i = 0, word = 0; i < 4; ++i)
          word = word << 8 | data[offp] & 255, offp = (offp + 1) % data.length;
        return { key: word, offp };
      }
      function _key(key, P, S) {
        var offset = 0, lr = [0, 0], plen = P.length, slen = S.length, sw;
        for (var i = 0; i < plen; i++)
          sw = _streamtoword(key, offset), offset = sw.offp, P[i] = P[i] ^ sw.key;
        for (i = 0; i < plen; i += 2)
          lr = _encipher(lr, 0, P, S), P[i] = lr[0], P[i + 1] = lr[1];
        for (i = 0; i < slen; i += 2)
          lr = _encipher(lr, 0, P, S), S[i] = lr[0], S[i + 1] = lr[1];
      }
      function _ekskey(data, key, P, S) {
        var offp = 0, lr = [0, 0], plen = P.length, slen = S.length, sw;
        for (var i = 0; i < plen; i++)
          sw = _streamtoword(key, offp), offp = sw.offp, P[i] = P[i] ^ sw.key;
        offp = 0;
        for (i = 0; i < plen; i += 2)
          sw = _streamtoword(data, offp), offp = sw.offp, lr[0] ^= sw.key, sw = _streamtoword(data, offp), offp = sw.offp, lr[1] ^= sw.key, lr = _encipher(lr, 0, P, S), P[i] = lr[0], P[i + 1] = lr[1];
        for (i = 0; i < slen; i += 2)
          sw = _streamtoword(data, offp), offp = sw.offp, lr[0] ^= sw.key, sw = _streamtoword(data, offp), offp = sw.offp, lr[1] ^= sw.key, lr = _encipher(lr, 0, P, S), S[i] = lr[0], S[i + 1] = lr[1];
      }
      function _crypt(b, salt, rounds, callback, progressCallback) {
        var cdata = C_ORIG.slice(), clen = cdata.length, err;
        if (rounds < 4 || rounds > 31) {
          err = Error("Illegal number of rounds (4-31): " + rounds);
          if (callback) {
            nextTick(callback.bind(this, err));
            return;
          } else
            throw err;
        }
        if (salt.length !== BCRYPT_SALT_LEN) {
          err = Error("Illegal salt length: " + salt.length + " != " + BCRYPT_SALT_LEN);
          if (callback) {
            nextTick(callback.bind(this, err));
            return;
          } else
            throw err;
        }
        rounds = 1 << rounds >>> 0;
        var P, S, i = 0, j;
        if (Int32Array) {
          P = new Int32Array(P_ORIG);
          S = new Int32Array(S_ORIG);
        } else {
          P = P_ORIG.slice();
          S = S_ORIG.slice();
        }
        _ekskey(salt, b, P, S);
        function next() {
          if (progressCallback)
            progressCallback(i / rounds);
          if (i < rounds) {
            var start = Date.now();
            for (; i < rounds; ) {
              i = i + 1;
              _key(b, P, S);
              _key(salt, P, S);
              if (Date.now() - start > MAX_EXECUTION_TIME)
                break;
            }
          } else {
            for (i = 0; i < 64; i++)
              for (j = 0; j < clen >> 1; j++)
                _encipher(cdata, j << 1, P, S);
            var ret = [];
            for (i = 0; i < clen; i++)
              ret.push((cdata[i] >> 24 & 255) >>> 0), ret.push((cdata[i] >> 16 & 255) >>> 0), ret.push((cdata[i] >> 8 & 255) >>> 0), ret.push((cdata[i] & 255) >>> 0);
            if (callback) {
              callback(null, ret);
              return;
            } else
              return ret;
          }
          if (callback)
            nextTick(next);
        }
        if (typeof callback !== "undefined") {
          next();
        } else {
          var res;
          while (true)
            if (typeof (res = next()) !== "undefined")
              return res || [];
        }
      }
      function _hash(s, salt, callback, progressCallback) {
        var err;
        if (typeof s !== "string" || typeof salt !== "string") {
          err = Error("Invalid string / salt: Not a string");
          if (callback) {
            nextTick(callback.bind(this, err));
            return;
          } else
            throw err;
        }
        var minor, offset;
        if (salt.charAt(0) !== "$" || salt.charAt(1) !== "2") {
          err = Error("Invalid salt version: " + salt.substring(0, 2));
          if (callback) {
            nextTick(callback.bind(this, err));
            return;
          } else
            throw err;
        }
        if (salt.charAt(2) === "$")
          minor = String.fromCharCode(0), offset = 3;
        else {
          minor = salt.charAt(2);
          if (minor !== "a" && minor !== "b" && minor !== "y" || salt.charAt(3) !== "$") {
            err = Error("Invalid salt revision: " + salt.substring(2, 4));
            if (callback) {
              nextTick(callback.bind(this, err));
              return;
            } else
              throw err;
          }
          offset = 4;
        }
        if (salt.charAt(offset + 2) > "$") {
          err = Error("Missing salt rounds");
          if (callback) {
            nextTick(callback.bind(this, err));
            return;
          } else
            throw err;
        }
        var r1 = parseInt(salt.substring(offset, offset + 1), 10) * 10, r2 = parseInt(salt.substring(offset + 1, offset + 2), 10), rounds = r1 + r2, real_salt = salt.substring(offset + 3, offset + 25);
        s += minor >= "a" ? "\0" : "";
        var passwordb = stringToBytes(s), saltb = base64_decode(real_salt, BCRYPT_SALT_LEN);
        function finish(bytes) {
          var res = [];
          res.push("$2");
          if (minor >= "a")
            res.push(minor);
          res.push("$");
          if (rounds < 10)
            res.push("0");
          res.push(rounds.toString());
          res.push("$");
          res.push(base64_encode(saltb, saltb.length));
          res.push(base64_encode(bytes, C_ORIG.length * 4 - 1));
          return res.join("");
        }
        if (typeof callback == "undefined")
          return finish(_crypt(passwordb, saltb, rounds));
        else {
          _crypt(passwordb, saltb, rounds, function(err2, bytes) {
            if (err2)
              callback(err2, null);
            else
              callback(null, finish(bytes));
          }, progressCallback);
        }
      }
      bcrypt2.encodeBase64 = base64_encode;
      bcrypt2.decodeBase64 = base64_decode;
      return bcrypt2;
    });
  }
});

// node_modules/cookie/index.js
var require_cookie = __commonJS({
  "node_modules/cookie/index.js"(exports) {
    "use strict";
    exports.parse = parse;
    exports.serialize = serialize2;
    var __toString = Object.prototype.toString;
    var fieldContentRegExp = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/;
    function parse(str, options) {
      if (typeof str !== "string") {
        throw new TypeError("argument str must be a string");
      }
      var obj = {};
      var opt = options || {};
      var dec = opt.decode || decode;
      var index = 0;
      while (index < str.length) {
        var eqIdx = str.indexOf("=", index);
        if (eqIdx === -1) {
          break;
        }
        var endIdx = str.indexOf(";", index);
        if (endIdx === -1) {
          endIdx = str.length;
        } else if (endIdx < eqIdx) {
          index = str.lastIndexOf(";", eqIdx - 1) + 1;
          continue;
        }
        var key = str.slice(index, eqIdx).trim();
        if (void 0 === obj[key]) {
          var val = str.slice(eqIdx + 1, endIdx).trim();
          if (val.charCodeAt(0) === 34) {
            val = val.slice(1, -1);
          }
          obj[key] = tryDecode(val, dec);
        }
        index = endIdx + 1;
      }
      return obj;
    }
    function serialize2(name, val, options) {
      var opt = options || {};
      var enc = opt.encode || encode;
      if (typeof enc !== "function") {
        throw new TypeError("option encode is invalid");
      }
      if (!fieldContentRegExp.test(name)) {
        throw new TypeError("argument name is invalid");
      }
      var value = enc(val);
      if (value && !fieldContentRegExp.test(value)) {
        throw new TypeError("argument val is invalid");
      }
      var str = name + "=" + value;
      if (null != opt.maxAge) {
        var maxAge = opt.maxAge - 0;
        if (isNaN(maxAge) || !isFinite(maxAge)) {
          throw new TypeError("option maxAge is invalid");
        }
        str += "; Max-Age=" + Math.floor(maxAge);
      }
      if (opt.domain) {
        if (!fieldContentRegExp.test(opt.domain)) {
          throw new TypeError("option domain is invalid");
        }
        str += "; Domain=" + opt.domain;
      }
      if (opt.path) {
        if (!fieldContentRegExp.test(opt.path)) {
          throw new TypeError("option path is invalid");
        }
        str += "; Path=" + opt.path;
      }
      if (opt.expires) {
        var expires = opt.expires;
        if (!isDate(expires) || isNaN(expires.valueOf())) {
          throw new TypeError("option expires is invalid");
        }
        str += "; Expires=" + expires.toUTCString();
      }
      if (opt.httpOnly) {
        str += "; HttpOnly";
      }
      if (opt.secure) {
        str += "; Secure";
      }
      if (opt.partitioned) {
        str += "; Partitioned";
      }
      if (opt.priority) {
        var priority = typeof opt.priority === "string" ? opt.priority.toLowerCase() : opt.priority;
        switch (priority) {
          case "low":
            str += "; Priority=Low";
            break;
          case "medium":
            str += "; Priority=Medium";
            break;
          case "high":
            str += "; Priority=High";
            break;
          default:
            throw new TypeError("option priority is invalid");
        }
      }
      if (opt.sameSite) {
        var sameSite = typeof opt.sameSite === "string" ? opt.sameSite.toLowerCase() : opt.sameSite;
        switch (sameSite) {
          case true:
            str += "; SameSite=Strict";
            break;
          case "lax":
            str += "; SameSite=Lax";
            break;
          case "strict":
            str += "; SameSite=Strict";
            break;
          case "none":
            str += "; SameSite=None";
            break;
          default:
            throw new TypeError("option sameSite is invalid");
        }
      }
      return str;
    }
    function decode(str) {
      return str.indexOf("%") !== -1 ? decodeURIComponent(str) : str;
    }
    function encode(val) {
      return encodeURIComponent(val);
    }
    function isDate(val) {
      return __toString.call(val) === "[object Date]" || val instanceof Date;
    }
    function tryDecode(str, decode2) {
      try {
        return decode2(str);
      } catch (e) {
        return str;
      }
    }
  }
});

// src/index.js
var bcrypt = __toESM(require_bcrypt());

// node_modules/nanoid/index.browser.js
var nanoid = (size = 21) => crypto.getRandomValues(new Uint8Array(size)).reduce((id, byte) => {
  byte &= 63;
  if (byte < 36) {
    id += byte.toString(36);
  } else if (byte < 62) {
    id += (byte - 26).toString(36).toUpperCase();
  } else if (byte > 62) {
    id += "-";
  } else {
    id += "_";
  }
  return id;
}, "");

// src/index.js
var import_cookie = __toESM(require_cookie());
var COOKIE_NAME = "library_session";
var ALLOWED_DOMAINS = {
  "student.pkujx.cn": "student",
  "pkujx.cn": "teacher",
  "qq.com": "student",
  "gmail.com": "student",
  "outlook.com": "student"
};
function createErrorResponse(message, status) {
  return new Response(JSON.stringify({ success: false, message }), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
async function handleEditBook(request, env, isbn) {
  const adminVerification = await verifyAdmin(request, env);
  if (!adminVerification.authorized) {
    return createErrorResponse(adminVerification.error, adminVerification.error.startsWith("Unauthorized") ? 401 : 403);
  }
  if (!isbn) {
    return createErrorResponse("ISBN is required in the path.", 400);
  }
  try {
    const existingBook = await getBookByISBN(env, isbn);
    if (!existingBook) {
      return createErrorResponse("Book with the given ISBN not found.", 404);
    }
    const requestBody = await request.json();
    const { title, author, publisher, publication_date, category_id, total_copies, available_copies, status } = requestBody;
    const updateFields = [];
    const params = [];
    if (title !== void 0) {
      updateFields.push("title = ?");
      params.push(title);
    }
    if (author !== void 0) {
      updateFields.push("author = ?");
      params.push(author);
    }
    if (publisher !== void 0) {
      updateFields.push("publisher = ?");
      params.push(publisher);
    }
    if (publication_date !== void 0) {
      updateFields.push("publication_date = ?");
      params.push(publication_date);
    }
    if (category_id !== void 0) {
      updateFields.push("category_id = ?");
      params.push(parseInt(category_id));
    }
    if (total_copies !== void 0) {
      const tc = parseInt(total_copies);
      if (isNaN(tc) || tc < 0)
        return createErrorResponse("Invalid total_copies value.", 400);
      updateFields.push("total_copies = ?");
      params.push(tc);
    }
    if (available_copies !== void 0) {
      const ac = parseInt(available_copies);
      if (isNaN(ac) || ac < 0)
        return createErrorResponse("Invalid available_copies value.", 400);
      if (total_copies !== void 0 && ac > parseInt(total_copies)) {
        return createErrorResponse("Available copies cannot exceed total copies.", 400);
      } else if (total_copies === void 0 && existingBook && ac > existingBook.total_copies) {
        return createErrorResponse("Available copies cannot exceed current total copies.", 400);
      }
      updateFields.push("available_copies = ?");
      params.push(ac);
    }
    if (status !== void 0) {
      updateFields.push("status = ?");
      params.push(status);
    }
    if (updateFields.length === 0) {
      return createErrorResponse("No fields provided for update.", 400);
    }
    params.push(isbn);
    const query = `UPDATE books SET ${updateFields.join(", ")} WHERE isbn = ?`;
    const { success, meta } = await env.DB.prepare(query).bind(...params).run();
    if (success && meta && meta.changes > 0) {
      const updatedBook = await getBookByISBN(env, isbn);
      return new Response(JSON.stringify({ success: true, message: "Book updated successfully.", book: updatedBook }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } else if (meta && meta.changes === 0) {
      return createErrorResponse("No changes made to the book or book not found.", 304);
    } else {
      return createErrorResponse("Failed to update book.", 500);
    }
  } catch (error) {
    console.error("Edit Book API Error:", error);
    if (error.message && error.message.includes("UNIQUE constraint failed")) {
      return createErrorResponse("Update failed due to a unique constraint violation (e.g., new ISBN if you were allowing ISBN change).", 409);
    }
    return createErrorResponse("Internal Server Error: " + error.message, 500);
  }
}
async function getBookByISBN(env, isbn) {
  const { results } = await env.DB.prepare("SELECT * FROM books WHERE isbn = ? LIMIT 1").bind(isbn).all();
  return results && results.length > 0 ? results[0] : null;
}
async function addBook(env, bookData) {
  const { isbn, title, author, publisher, publication_date, category_id, total_copies, status } = bookData;
  try {
    await env.DB.prepare(
      "INSERT INTO books (isbn, title, author, publisher, publication_date, category_id, total_copies, available_copies, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(isbn, title, author, publisher, publication_date, category_id, total_copies, total_copies, status).run();
    return true;
  } catch (error) {
    console.error("\u6DFB\u52A0\u56FE\u4E66\u5931\u8D25\uFF1A", error);
    return false;
  }
}
async function verifyAdmin(request, env) {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) {
    return { authorized: false, error: "Unauthorized: No cookie provided" };
  }
  const cookies = cookieHeader.split(";");
  let sessionId = null;
  for (const cookie of cookies) {
    const trimmedCookie = cookie.trim();
    if (trimmedCookie.startsWith(`${COOKIE_NAME}=`)) {
      sessionId = trimmedCookie.substring(`${COOKIE_NAME}=`.length);
      break;
    }
  }
  if (!sessionId) {
    return { authorized: false, error: "Unauthorized: Invalid session cookie format" };
  }
  try {
    const { results } = await env.DB.prepare(
      "SELECT user_id, role FROM sessions WHERE id = ? AND expiry > ? LIMIT 1"
    ).bind(sessionId, Date.now()).all();
    if (!results || results.length === 0) {
      return { authorized: false, error: "Unauthorized: Invalid or expired session" };
    }
    const session = results[0];
    if (session.role !== "admin") {
      return { authorized: false, error: "Forbidden: Insufficient privileges" };
    }
    return { authorized: true, userId: session.user_id, role: session.role };
  } catch (error) {
    console.error("\u9A8C\u8BC1\u7BA1\u7406\u5458\u8EAB\u4EFD\u5931\u8D25\uFF1A", error);
    return { authorized: false, error: "Internal Server Error: Failed to verify admin status" };
  }
}
async function handleAddBook(request, env) {
  const adminVerification = await verifyAdmin(request, env);
  if (!adminVerification.authorized) {
    return createErrorResponse(adminVerification.error, adminVerification.error.startsWith("Unauthorized") ? 401 : 403);
  }
  try {
    const requestBody = await request.json();
    const { isbn, title, author, publisher, publication_date, category_id, total_copies, status } = requestBody;
    if (!isbn || !title || !category_id) {
      return createErrorResponse("Missing required fields (isbn, title, category_id)", 400);
    }
    const existingBook = await getBookByISBN(env, isbn);
    if (existingBook) {
      return createErrorResponse("ISBN already exists", 409);
    }
    const bookData = {
      isbn,
      title,
      author: author || null,
      publisher: publisher || null,
      publication_date: publication_date || null,
      category_id,
      total_copies: total_copies || 1,
      status: status || "\u5728\u9986"
    };
    const success = await addBook(env, bookData);
    if (success) {
      return new Response(
        JSON.stringify({ success: true, message: "Book added successfully", book: bookData }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    } else {
      return createErrorResponse("Failed to add book", 500);
    }
  } catch (error) {
    console.error("\u6DFB\u52A0\u56FE\u4E66 API \u9519\u8BEF\uFF1A", error);
    return createErrorResponse("Internal Server Error: " + error.message, 500);
  }
}
async function deleteBook(env, isbn) {
  try {
    await env.DB.prepare("DELETE FROM books WHERE isbn = ?").bind(isbn).run();
    return true;
  } catch (error) {
    console.error("\u5220\u9664\u56FE\u4E66\u5931\u8D25\uFF1A", error);
    return false;
  }
}
async function handleDeleteBook(request, env) {
  const adminVerification = await verifyAdmin(request, env);
  if (!adminVerification.authorized) {
    return createErrorResponse(adminVerification.error, adminVerification.error.startsWith("Unauthorized") ? 401 : 403);
  }
  try {
    const requestBody = await request.json();
    const { isbn } = requestBody;
    if (!isbn) {
      return createErrorResponse("Missing required field (isbn)", 400);
    }
    const existingBook = await getBookByISBN(env, isbn);
    if (!existingBook) {
      return createErrorResponse("ISBN not found", 404);
    }
    const { results } = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM borrowed_books WHERE isbn = ? AND returned = 0"
    ).bind(isbn).first();
    if (results && results.count > 0) {
      return createErrorResponse("Book has unreturned borrow records and cannot be deleted", 409);
    }
    const success = await deleteBook(env, isbn);
    if (success) {
      return new Response(
        JSON.stringify({ success: true, message: "Book deleted successfully" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } else {
      return createErrorResponse("Failed to delete book", 500);
    }
  } catch (error) {
    console.error("\u5220\u9664\u56FE\u4E66 API \u9519\u8BEF\uFF1A", error);
    return createErrorResponse("Internal Server Error: " + error.message, 500);
  }
}
async function verifyUser(request, env) {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) {
    return { authorized: false, error: "Unauthorized: No cookie provided" };
  }
  const cookies = cookieHeader.split(";");
  let sessionId = null;
  for (const cookie of cookies) {
    const trimmedCookie = cookie.trim();
    if (trimmedCookie.startsWith(`${COOKIE_NAME}=`)) {
      sessionId = trimmedCookie.substring(`${COOKIE_NAME}=`.length);
      break;
    }
  }
  if (!sessionId) {
    return { authorized: false, error: "Unauthorized: Invalid session cookie format" };
  }
  try {
    const { results: sessionResults } = await env.DB.prepare(
      "SELECT user_id, role FROM sessions WHERE id = ? AND expiry > ? LIMIT 1"
    ).bind(sessionId, Date.now()).all();
    if (!sessionResults || sessionResults.length === 0) {
      return { authorized: false, error: "Unauthorized: Invalid or expired session" };
    }
    return { authorized: true, userId: sessionResults[0].user_id, role: sessionResults[0].role };
  } catch (error) {
    console.error("\u9A8C\u8BC1\u7528\u6237\u8EAB\u4EFD\u5931\u8D25\uFF1A", error);
    return { authorized: false, error: "Internal Server Error: Failed to verify user status" };
  }
}
async function handleSearchBook(request, env) {
  const userVerification = await verifyUser(request, env);
  if (!userVerification.authorized) {
    return createErrorResponse(userVerification.error, 401);
  }
  try {
    const url = new URL(request.url);
    const isbn = url.searchParams.get("isbn");
    const title = url.searchParams.get("title");
    const author = url.searchParams.get("author");
    const category_id = url.searchParams.get("category_id");
    const status = url.searchParams.get("status");
    let query = "SELECT * FROM books WHERE 1=1";
    const params = [];
    if (isbn) {
      query += " AND isbn = ?";
      params.push(isbn);
    }
    if (title) {
      query += " AND title LIKE ?";
      params.push(`%${title}%`);
    }
    if (author) {
      query += " AND author LIKE ?";
      params.push(`%${author}%`);
    }
    if (category_id) {
      query += " AND category_id = ?";
      params.push(category_id);
    }
    if (status) {
      query += " AND status = ?";
      params.push(status);
    }
    const { results } = await env.DB.prepare(query).bind(...params).all();
    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("\u67E5\u627E\u56FE\u4E66 API \u9519\u8BEF\uFF1A", error);
    return createErrorResponse("Internal Server Error: " + error.message, 500);
  }
}
async function borrowBookDB(env, isbn, user_id, due_date) {
  try {
    const borrow_date = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    await env.DB.prepare(
      "INSERT INTO borrowed_books (isbn, user_id, borrow_date, due_date, returned) VALUES (?, ?, ?, ?, ?)"
    ).bind(isbn, user_id, borrow_date, due_date, 0).run();
    await env.DB.prepare("UPDATE books SET available_copies = available_copies - 1 WHERE isbn = ?").bind(isbn).run();
    return true;
  } catch (error) {
    console.error("\u501F\u9605\u56FE\u4E66\u5931\u8D25\uFF1A", error);
    return false;
  }
}
async function handleBorrowBook(request, env) {
  const adminVerification = await verifyAdmin(request, env);
  if (!adminVerification.authorized) {
    return createErrorResponse(adminVerification.error, adminVerification.error.startsWith("Unauthorized") ? 401 : 403);
  }
  try {
    const requestBody = await request.json();
    const { isbn, user_id, due_date } = requestBody;
    if (!isbn || !user_id || !due_date) {
      return createErrorResponse("Missing required fields (isbn, user_id, due_date)", 400);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due_date)) {
      return createErrorResponse("Invalid due_date format. Use YYYY-MM-DD", 400);
    }
    const existingBook = await getBookByISBN(env, isbn);
    if (!existingBook) {
      return createErrorResponse("ISBN not found", 404);
    }
    const { results: userResults } = await env.DB.prepare(
      "SELECT id FROM users WHERE id = ? LIMIT 1"
    ).bind(user_id).all();
    if (!userResults || userResults.length === 0) {
      return createErrorResponse("User ID not found", 404);
    }
    if (existingBook.available_copies <= 0) {
      return createErrorResponse("No available copies of this book", 409);
    }
    const success = await borrowBookDB(env, isbn, user_id, due_date);
    if (success) {
      return new Response(
        JSON.stringify({ success: true, message: "Book borrowed successfully" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } else {
      return createErrorResponse("Failed to borrow book", 500);
    }
  } catch (error) {
    console.error("\u501F\u9605\u56FE\u4E66 API \u9519\u8BEF\uFF1A", error);
    return createErrorResponse("Internal Server Error: " + error.message, 500);
  }
}
async function returnBookDB(env, isbn, user_id) {
  try {
    const return_date = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const { changes } = await env.DB.prepare(
      "UPDATE borrowed_books SET returned = 1, return_date = ? WHERE isbn = ? AND user_id = ? AND returned = 0"
    ).bind(return_date, isbn, user_id).run();
    if (changes === 0) {
      return false;
    }
    await env.DB.prepare("UPDATE books SET available_copies = available_copies + 1 WHERE isbn = ?").bind(isbn).run();
    return true;
  } catch (error) {
    console.error("\u5F52\u8FD8\u56FE\u4E66\u5931\u8D25\uFF1A", error);
    return false;
  }
}
async function handleReturnBook(request, env) {
  const adminVerification = await verifyAdmin(request, env);
  if (!adminVerification.authorized) {
    return createErrorResponse(adminVerification.error, adminVerification.error.startsWith("Unauthorized") ? 401 : 403);
  }
  try {
    const requestBody = await request.json();
    const { isbn, user_id } = requestBody;
    if (!isbn || !user_id) {
      return createErrorResponse("Missing required fields (isbn, user_id)", 400);
    }
    const existingBook = await getBookByISBN(env, isbn);
    if (!existingBook) {
      return createErrorResponse("ISBN not found", 404);
    }
    const { results: userResults } = await env.DB.prepare(
      "SELECT id FROM users WHERE id = ? LIMIT 1"
    ).bind(user_id).all();
    if (!userResults || userResults.length === 0) {
      return createErrorResponse("User ID not found", 404);
    }
    const { results: borrowedResults } = await env.DB.prepare(
      "SELECT id FROM borrowed_books WHERE isbn = ? AND user_id = ? AND returned = 0 LIMIT 1"
    ).bind(isbn, user_id).all();
    if (!borrowedResults || borrowedResults.length === 0) {
      return createErrorResponse("No active borrow record found for this user and book", 404);
    }
    const success = await returnBookDB(env, isbn, user_id);
    if (success) {
      return new Response(
        JSON.stringify({ success: true, message: "Book returned successfully" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } else {
      return createErrorResponse("Failed to return book", 500);
    }
  } catch (error) {
    console.error("\u5F52\u8FD8\u56FE\u4E66 API \u9519\u8BEF\uFF1A", error);
    return createErrorResponse("Internal Server Error: " + error.message, 500);
  }
}
async function handleAdminLibrary(request, env) {
  const adminVerification = await verifyAdmin(request, env);
  if (!adminVerification.authorized) {
    return createErrorResponse(adminVerification.error, adminVerification.error.startsWith("Unauthorized") ? 401 : 403);
  }
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    switch (action) {
      case "borrowed_records":
        return handleBorrowedRecords(request, env);
      case "overdue":
        return handleOverdue(request, env);
      case "book_status":
        return handleBookStatus(request, env);
      default:
        return createErrorResponse("Invalid action", 400);
    }
  } catch (error) {
    console.error("Admin Library API \u9519\u8BEF\uFF1A", error);
    return createErrorResponse("Internal Server Error: " + error.message, 500);
  }
}
async function handleBorrowedRecords(request, env) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("user_id");
  const isbn = url.searchParams.get("isbn");
  const returned = url.searchParams.get("returned");
  const current = url.searchParams.get("current");
  let query = "SELECT bb.*, u.username, b.title as book_title FROM borrowed_books bb JOIN users u ON bb.user_id = u.id JOIN books b ON bb.isbn = b.isbn WHERE 1=1";
  const params = [];
  if (userId) {
    query += " AND bb.user_id = ?";
    params.push(userId);
  }
  if (isbn) {
    query += " AND bb.isbn = ?";
    params.push(isbn);
  }
  if (returned) {
    query += " AND bb.returned = ?";
    params.push(returned);
  }
  if (current === "1") {
    query += " AND bb.returned = 0";
  }
  try {
    const { results } = await env.DB.prepare(query).bind(...params).all();
    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("\u501F\u9605\u8BB0\u5F55\u67E5\u8BE2\u9519\u8BEF\uFF1A", error);
    return createErrorResponse("Internal Server Error: " + error.message, 500);
  }
}
async function handleOverdue(request, env) {
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const query = "SELECT bb.*, u.username, b.title as book_title FROM borrowed_books bb JOIN users u ON bb.user_id = u.id JOIN books b ON bb.isbn = b.isbn WHERE bb.due_date < ? AND bb.returned = 0";
  try {
    const { results } = await env.DB.prepare(query).bind(today).all();
    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("\u903E\u671F\u7BA1\u7406\u9519\u8BEF\uFF1A", error);
    return createErrorResponse("Internal Server Error: " + error.message, 500);
  }
}
async function handleBookStatus(request, env) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  if (!status) {
    return createErrorResponse("Missing required parameter: status", 400);
  }
  const query = "SELECT * FROM books WHERE status = ?";
  try {
    const { results } = await env.DB.prepare(query).bind(status).all();
    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("\u56FE\u4E66\u72B6\u6001\u7BA1\u7406\u9519\u8BEF\uFF1A", error);
    return createErrorResponse("Internal Server Error: " + error.message, 500);
  }
}
async function handleRegister(request, env) {
  try {
    const { email, password, username } = await request.json();
    if (!email || !password || !username) {
      return createErrorResponse("Email, password, and username are required", 400);
    }
    if (!email.includes("@")) {
      return createErrorResponse("Invalid email format", 400);
    }
    const domain = email.split("@")[1];
    const role = ALLOWED_DOMAINS[domain];
    if (!role) {
      return createErrorResponse("Email domain is not allowed", 400);
    }
    const { results: existingUsers } = await env.DB.prepare(
      "SELECT id FROM users WHERE email = ? LIMIT 1"
    ).bind(email).all();
    if (existingUsers && existingUsers.length > 0) {
      return createErrorResponse("Email already registered", 409);
    }
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const { success } = await env.DB.prepare(
      "INSERT INTO users (email, username, password, role) VALUES (?, ?, ?, ?)"
    ).bind(email, username, hashedPassword, role).run();
    if (success) {
      return new Response(JSON.stringify({ success: true, message: "Registration successful" }), {
        status: 201,
        headers: { "Content-Type": "application/json" }
      });
    } else {
      return createErrorResponse("Registration failed", 500);
    }
  } catch (error) {
    console.error("\u6CE8\u518C\u9519\u8BEF\uFF1A", error);
    return createErrorResponse("Registration failed, please try again later", 500);
  }
}
async function handleLogin(request, env) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return createErrorResponse("Email and password are required", 400);
    }
    const { results } = await env.DB.prepare(
      "SELECT id, email, username, password, role FROM users WHERE email = ? LIMIT 1"
    ).bind(email).all();
    if (!results || results.length === 0) {
      return createErrorResponse("User not found or incorrect credentials", 401);
    }
    const user = results[0];
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return createErrorResponse("User not found or incorrect credentials", 401);
    }
    const sessionId = nanoid();
    const expiry = Date.now() + 24 * 60 * 60 * 1e3;
    await env.DB.prepare(
      "INSERT INTO sessions (id, user_id, email, username, role, expiry) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(sessionId, user.id, user.email, user.username, user.role, expiry).run();
    const cookie = (0, import_cookie.serialize)(COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: true,
      // 生产环境应为 true
      sameSite: "None",
      // 允许跨站发送 Cookie
      path: "/",
      expires: new Date(expiry)
    });
    return new Response(JSON.stringify({
      success: true,
      message: "Login successful",
      user: { id: user.id, email: user.email, username: user.username, role: user.role, sessionId }
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": cookie
      }
    });
  } catch (error) {
    console.error("\u767B\u5F55\u9519\u8BEF\uFF1A", error);
    return createErrorResponse("Login failed, please try again later", 500);
  }
}
async function handleGetUser(request, env) {
  const userVerification = await verifyUser(request, env);
  if (!userVerification.authorized) {
    return createErrorResponse(userVerification.error, 401);
  }
  try {
    const { results: userResults } = await env.DB.prepare(
      "SELECT id, email, username, role FROM users WHERE id = ? LIMIT 1"
    ).bind(userVerification.userId).all();
    if (!userResults || userResults.length === 0) {
      return createErrorResponse("User not found", 404);
    }
    const user = userResults[0];
    return new Response(JSON.stringify({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("\u5904\u7406 /api/user GET \u8BF7\u6C42\u65F6\u53D1\u751F\u9519\u8BEF\uFF1A", error);
    return createErrorResponse("Internal Server Error", 500);
  }
}
async function handlePostUser(request, env) {
  const adminVerification = await verifyAdmin(request, env);
  if (!adminVerification.authorized) {
    return createErrorResponse(adminVerification.error, adminVerification.error.startsWith("Unauthorized") ? 401 : 403);
  }
  return new Response(JSON.stringify({
    success: true,
    message: "Admin verified",
    user: {
      // 可以从 adminVerification 中获取更多信息如果需要
      userId: adminVerification.userId,
      role: adminVerification.role
    }
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
async function handleAdminGetUsers(request, env) {
  const adminVerification = await verifyAdmin(request, env);
  if (!adminVerification.authorized) {
    return createErrorResponse(adminVerification.error, adminVerification.error.startsWith("Unauthorized") ? 401 : 403);
  }
  try {
    const url = new URL(request.url);
    const searchQuery = url.searchParams.get("search");
    const roleFilter = url.searchParams.get("role");
    let query = "SELECT id, username, email, role, created_at FROM users WHERE 1=1";
    const params = [];
    if (searchQuery) {
      query += " AND (username LIKE ? OR email LIKE ?)";
      params.push(`%${searchQuery}%`, `%${searchQuery}%`);
    }
    if (roleFilter) {
      query += " AND role = ?";
      params.push(roleFilter);
    }
    query += " ORDER BY created_at DESC";
    const { results } = await env.DB.prepare(query).bind(...params).all();
    return new Response(JSON.stringify({ success: true, users: results }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Admin Get Users API Error:", error);
    return createErrorResponse("Internal Server Error: " + error.message, 500);
  }
}
async function handleAdminGetUserById(request, env, userId) {
  const adminVerification = await verifyAdmin(request, env);
  if (!adminVerification.authorized) {
    return createErrorResponse(adminVerification.error, adminVerification.error.startsWith("Unauthorized") ? 401 : 403);
  }
  if (!userId) {
    return createErrorResponse("User ID is required in the path.", 400);
  }
  try {
    const { results } = await env.DB.prepare(
      "SELECT id, username, email, role, created_at FROM users WHERE id = ? LIMIT 1"
    ).bind(userId).all();
    if (!results || results.length === 0) {
      return createErrorResponse("User not found.", 404);
    }
    return new Response(JSON.stringify({ success: true, user: results[0] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Admin Get User By ID API Error:", error);
    return createErrorResponse("Internal Server Error: " + error.message, 500);
  }
}
async function handleAdminCreateUser(request, env) {
  const adminVerification = await verifyAdmin(request, env);
  if (!adminVerification.authorized) {
    return createErrorResponse(adminVerification.error, adminVerification.error.startsWith("Unauthorized") ? 401 : 403);
  }
  try {
    const { email, password, username, role } = await request.json();
    if (!email || !password || !username || !role) {
      return createErrorResponse("Email, password, username, and role are required.", 400);
    }
    if (!["student", "teacher", "admin"].includes(role)) {
      return createErrorResponse("Invalid role. Must be student, teacher, or admin.", 400);
    }
    if (!email.includes("@")) {
      return createErrorResponse("Invalid email format.", 400);
    }
    const { results: existingUsers } = await env.DB.prepare(
      "SELECT id FROM users WHERE email = ? LIMIT 1"
    ).bind(email).all();
    if (existingUsers && existingUsers.length > 0) {
      return createErrorResponse("Email already registered.", 409);
    }
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const { meta } = await env.DB.prepare(
      "INSERT INTO users (email, username, password, role) VALUES (?, ?, ?, ?)"
    ).bind(email, username, hashedPassword, role).run();
    if (meta && meta.last_row_id) {
      const newUser = { id: meta.last_row_id, email, username, role };
      return new Response(JSON.stringify({ success: true, message: "User created successfully.", user: newUser }), {
        status: 201,
        headers: { "Content-Type": "application/json" }
      });
    } else {
      return createErrorResponse("Failed to create user.", 500);
    }
  } catch (error) {
    console.error("Admin Create User API Error:", error);
    if (error.message && error.message.includes("UNIQUE constraint failed")) {
      return createErrorResponse("Failed to create user. A unique field (like username or email) might already exist.", 409);
    }
    return createErrorResponse("Internal Server Error: " + error.message, 500);
  }
}
async function handleAdminUpdateUser(request, env, userId) {
  const adminVerification = await verifyAdmin(request, env);
  if (!adminVerification.authorized) {
    return createErrorResponse(adminVerification.error, adminVerification.error.startsWith("Unauthorized") ? 401 : 403);
  }
  if (!userId) {
    return createErrorResponse("User ID is required in the path.", 400);
  }
  try {
    const { username, email, role, newPassword } = await request.json();
    const { results: existingUserResults } = await env.DB.prepare(
      "SELECT id FROM users WHERE id = ? LIMIT 1"
    ).bind(userId).all();
    if (!existingUserResults || existingUserResults.length === 0) {
      return createErrorResponse("User not found.", 404);
    }
    const updateFields = [];
    const params = [];
    if (username) {
      updateFields.push("username = ?");
      params.push(username);
    }
    if (email) {
      if (!email.includes("@")) {
        return createErrorResponse("Invalid email format.", 400);
      }
      const { results: emailCheck } = await env.DB.prepare(
        "SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1"
      ).bind(email, userId).all();
      if (emailCheck && emailCheck.length > 0) {
        return createErrorResponse("Email already in use by another account.", 409);
      }
      updateFields.push("email = ?");
      params.push(email);
    }
    if (role) {
      if (!["student", "teacher", "admin"].includes(role)) {
        return createErrorResponse("Invalid role. Must be student, teacher, or admin.", 400);
      }
      updateFields.push("role = ?");
      params.push(role);
    }
    if (newPassword) {
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
      updateFields.push("password = ?");
      params.push(hashedPassword);
    }
    if (updateFields.length === 0) {
      return createErrorResponse("No fields provided for update.", 400);
    }
    params.push(userId);
    const query = `UPDATE users SET ${updateFields.join(", ")} WHERE id = ?`;
    const { success } = await env.DB.prepare(query).bind(...params).run();
    if (success) {
      const { results: updatedUserResults } = await env.DB.prepare(
        "SELECT id, username, email, role, created_at FROM users WHERE id = ? LIMIT 1"
      ).bind(userId).all();
      return new Response(JSON.stringify({ success: true, message: "User updated successfully.", user: updatedUserResults[0] }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } else {
      return createErrorResponse("Failed to update user.", 500);
    }
  } catch (error) {
    console.error("Admin Update User API Error:", error);
    if (error.message && error.message.includes("UNIQUE constraint failed")) {
      return createErrorResponse("Failed to update user. A unique field (like new username or email) might conflict.", 409);
    }
    return createErrorResponse("Internal Server Error: " + error.message, 500);
  }
}
async function handleAdminDeleteUser(request, env, userId) {
  const adminVerification = await verifyAdmin(request, env);
  if (!adminVerification.authorized) {
    return createErrorResponse(adminVerification.error, adminVerification.error.startsWith("Unauthorized") ? 401 : 403);
  }
  if (!userId) {
    return createErrorResponse("User ID is required in the path.", 400);
  }
  try {
    const { results: existingUserResults } = await env.DB.prepare(
      "SELECT id FROM users WHERE id = ? LIMIT 1"
    ).bind(userId).all();
    if (!existingUserResults || existingUserResults.length === 0) {
      return createErrorResponse("User not found.", 404);
    }
    const { results: borrowedBooks } = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM borrowed_books WHERE user_id = ? AND returned = 0"
    ).bind(userId).first();
    if (borrowedBooks && borrowedBooks.count > 0) {
      return createErrorResponse(`Cannot delete user. User has ${borrowedBooks.count} unreturned book(s).`, 409);
    }
    await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId).run();
    const { success } = await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();
    if (success) {
      return new Response(JSON.stringify({ success: true, message: "User deleted successfully." }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } else {
      return createErrorResponse("Failed to delete user.", 500);
    }
  } catch (error) {
    console.error("Admin Delete User API Error:", error);
    return createErrorResponse("Internal Server Error: " + error.message, 500);
  }
}
async function handleGetTopBorrowers(request, env) {
  const userVerification = await verifyUser(request, env);
  if (!userVerification.authorized) {
    return createErrorResponse(userVerification.error, 401);
  }
  try {
    const url = new URL(request.url);
    const daysParam = url.searchParams.get("days");
    const limitParam = url.searchParams.get("limit");
    const days = parseInt(daysParam) || 30;
    const limit = parseInt(limitParam) || 10;
    if (days <= 0 || limit <= 0) {
      return createErrorResponse("Parameters 'days' and 'limit' must be positive integers.", 400);
    }
    const dateNdaysAgo = /* @__PURE__ */ new Date();
    dateNdaysAgo.setDate(dateNdaysAgo.getDate() - days);
    const startDate = dateNdaysAgo.toISOString().split("T")[0];
    const query = `
            SELECT
                u.id AS user_id,
                u.username,
                u.email, 
                COUNT(bb.id) AS borrow_count
            FROM borrowed_books bb
            JOIN users u ON bb.user_id = u.id
            WHERE bb.borrow_date >= ?
            GROUP BY u.id, u.username, u.email
            ORDER BY borrow_count DESC
            LIMIT ?
        `;
    const { results } = await env.DB.prepare(query).bind(startDate, limit).all();
    return new Response(JSON.stringify({ success: true, topBorrowers: results }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Get Top Borrowers API Error:", error);
    return createErrorResponse("Internal Server Error: " + error.message, 500);
  }
}
async function handleAdminGetStats(request, env) {
  const adminVerification = await verifyAdmin(request, env);
  if (!adminVerification.authorized) {
    return createErrorResponse(adminVerification.error, adminVerification.error.startsWith("Unauthorized") ? 401 : 403);
  }
  try {
    const { results: booksCountResult } = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM books"
    ).first();
    const totalBooks = booksCountResult ? booksCountResult.count : 0;
    const { results: usersCountResult } = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM users"
    ).first();
    const totalUsers = usersCountResult ? usersCountResult.count : 0;
    const { results: currentBorrowsResult } = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM borrowed_books WHERE returned = 0"
    ).first();
    const currentBorrows = currentBorrowsResult ? currentBorrowsResult.count : 0;
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const { results: overdueBorrowsResult } = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM borrowed_books WHERE due_date < ? AND returned = 0"
    ).bind(today).first();
    const overdueBorrows = overdueBorrowsResult ? overdueBorrowsResult.count : 0;
    const daysForNewUsers = 7;
    const dateNdaysAgoUsers = /* @__PURE__ */ new Date();
    dateNdaysAgoUsers.setDate(dateNdaysAgoUsers.getDate() - daysForNewUsers);
    const startDateNewUsers = dateNdaysAgoUsers.toISOString().split("T")[0];
    const { results: newUsersCountResult } = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM users WHERE SUBSTR(created_at, 1, 10) >= ?"
    ).bind(startDateNewUsers).first();
    const newUsersLast7Days = newUsersCountResult ? newUsersCountResult.count : 0;
    return new Response(JSON.stringify({
      success: true,
      stats: {
        totalBooks,
        totalUsers,
        currentBorrows,
        overdueBorrows,
        newUsersLast7Days
        // 可选
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Admin Get Stats API Error:", error);
    return createErrorResponse("Internal Server Error: " + error.message, 500);
  }
}
var src_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie, X-Requested-With",
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Max-Age": "86400"
        }
      });
    }
    let response;
    if (method === "POST" && path === "/api/register") {
      response = await handleRegister(request, env);
    } else if (method === "POST" && path === "/api/login") {
      response = await handleLogin(request, env);
    } else if (method === "GET" && path === "/api/user") {
      response = await handleGetUser(request, env);
    } else if (method === "POST" && path === "/api/user") {
      response = await handlePostUser(request, env);
    } else if (method === "POST" && path === "/addbooks") {
      response = await handleAddBook(request, env);
    } else if (method === "DELETE" && path === "/deletebooks") {
      response = await handleDeleteBook(request, env);
    } else if (method === "GET" && path === "/searchbooks") {
      response = await handleSearchBook(request, env);
    } else if (method === "POST" && path === "/borrowbooks") {
      response = await handleBorrowBook(request, env);
    } else if (method === "PUT" && path === "/returnbooks") {
      response = await handleReturnBook(request, env);
    } else if (method === "GET" && path === "/managebooks") {
      response = await handleAdminLibrary(request, env);
    } else if (method === "PUT" && path.startsWith("/editbook/")) {
      const isbn = path.substring("/editbook/".length);
      if (isbn) {
        response = await handleEditBook(request, env, isbn);
      } else {
        response = createErrorResponse("ISBN is missing in the path for editing a book.", 400);
      }
    } else if (path.startsWith("/api/admin/users")) {
      const userIdMatch = path.match(/^\/api\/admin\/users\/([a-zA-Z0-9_-]+)$/);
      if (method === "GET") {
        if (userIdMatch) {
          response = await handleAdminGetUserById(request, env, userIdMatch[1]);
        } else if (path === "/api/admin/users") {
          response = await handleAdminGetUsers(request, env);
        }
      } else if (method === "POST" && path === "/api/admin/users") {
        response = await handleAdminCreateUser(request, env);
      } else if (method === "PUT" && userIdMatch) {
        response = await handleAdminUpdateUser(request, env, userIdMatch[1]);
      } else if (method === "DELETE" && userIdMatch) {
        response = await handleAdminDeleteUser(request, env, userIdMatch[1]);
      }
    } else if (method === "GET" && path === "/api/admin/stats") {
      response = await handleAdminGetStats(request, env);
    } else if (method === "GET" && path === "/api/stats/top-borrowers") {
      response = await handleGetTopBorrowers(request, env);
    } else {
      response = createErrorResponse("Not Found: The requested endpoint does not exist.", 404);
    }
    if (response) {
      const finalResponse = new Response(response.body, response);
      finalResponse.headers.set("Access-Control-Allow-Origin", request.headers.get("Origin") || "*");
      finalResponse.headers.set("Access-Control-Allow-Credentials", "true");
      return finalResponse;
    }
    return createErrorResponse("Internal Server Error: No response generated.", 500);
  }
};
export {
  src_default as default
};
/*! Bundled license information:

bcryptjs/dist/bcrypt.js:
  (**
   * @license bcrypt.js (c) 2013 Daniel Wirtz <dcode@dcode.io>
   * Released under the Apache License, Version 2.0
   * see: https://github.com/dcodeIO/bcrypt.js for details
   *)

cookie/index.js:
  (*!
   * cookie
   * Copyright(c) 2012-2014 Roman Shtylman
   * Copyright(c) 2015 Douglas Christopher Wilson
   * MIT Licensed
   *)
*/
