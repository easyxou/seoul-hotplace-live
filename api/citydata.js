const PLACES = {
  POI068: "성수카페거리",
  POI007: "홍대 관광특구",
  POI003: "명동 관광특구",
  POI009: "광화문·덕수궁",
  POI001: "강남 MICE 관광특구",
  POI014: "강남역",
  POI071: "압구정로데오거리",
  POI073: "연남동",
  POI066: "북촌한옥마을",
  POI078: "인사동",
  POI072: "여의도",
  POI002: "동대문 관광특구",
  POI064: "덕수궁길·정동길"
};

function first(value) {
  if (Array.isArray(value)) return value[0] || {};
  if (value && typeof value === "object") return value;
  return {};
}

function normalizeStatus(status = "보통") {
  const compact = String(status).replace(/\s/g, "");
  if (compact.includes("붐빔") && !compact.includes("약간")) return "붐빔";
  if (compact.includes("약간")) return "약간 붐빔";
  if (compact.includes("여유")) return "여유";
  return "보통";
}

function score(status) {
  const s = normalizeStatus(status);
  if (s === "여유") return 92;
  if (s === "보통") return 78;
  if (s === "약간 붐빔") return 62;
  return 38;
}

module.exports = async function handler(req, res) {
  const key = process.env.SEOUL_API_KEY;
  const poi = String(req.query.poi || "POI068");

  if (!key) {
    return res.status(500).json({
      ok: false,
      error: "SEOUL_API_KEY 환경변수가 설정되지 않았어요."
    });
  }

  try {
    const url = `http://openapi.seoul.go.kr:8088/${key}/json/citydata/1/5/${encodeURIComponent(poi)}`;
    const response = await fetch(url);
    const json = await response.json();

    const root = json["SeoulRtd.citydata"] || json.citydata || json;
    const city = root.CITYDATA || root.citydata || root;

    const live = first(city.LIVE_PPLTN_STTS?.LIVE_PPLTN_STTS || city.LIVE_PPLTN_STTS);
    const weather = first(city.WEATHER_STTS?.WEATHER_STTS || city.WEATHER_STTS);
    const bike = first(city.BIKE_STTS?.BIKE_STTS || city.BIKE_STTS);

    const rawStatus = live.AREA_CONGEST_LVL || live.AREA_CONGEST_LVL_NM || "보통";
    const area = city.AREA_NM || live.AREA_NM || PLACES[poi] || poi;

    const min = live.AREA_PPLTN_MIN;
    const max = live.AREA_PPLTN_MAX;

    const weatherName = weather.WEATHER_NM || weather.SKY_STTS || "날씨 정보 없음";
    const temp = weather.TEMP ? `${weather.TEMP}℃` : "기온 정보 없음";
    const pm10 = weather.PM10_INDEX || weather.PM10 || "정보 없음";
    const pm25 = weather.PM25_INDEX || weather.PM25 || "정보 없음";
    const bikeCount = bike.RENT_BIKE_CNT || bike.BIKE_CNT || bike.PARKING_BIKE_TOT_CNT;

    const status = normalizeStatus(rawStatus);

    return res.status(200).json({
      ok: true,
      area,
      status,
      score: score(status),
      message:
        live.AREA_CONGEST_MSG ||
        `${area}의 현재 혼잡도는 ${status} 수준이에요.`,
      population:
        min && max
          ? `${Number(min).toLocaleString()}명 ~ ${Number(max).toLocaleString()}명`
          : "인구 범위 정보 없음",
      time: live.PPLTN_TIME || "최근 업데이트",
      weather: `${weatherName} · ${temp}`,
      air: `미세먼지 ${pm10} · 초미세먼지 ${pm25}`,
      transit: "교통 정보 확인 중",
      bike: bikeCount ? `따릉이 ${bikeCount}대` : "따릉이 정보 없음",
      event: "행사 정보 확인 중",
      trend: "현재 기준"
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || "서울시 API를 불러오지 못했어요."
    });
  }
};
