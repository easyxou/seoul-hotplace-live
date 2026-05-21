const PLACES = {
  POI009: "광화문·덕수궁",
  POI068: "성수카페거리",
  POI007: "홍대 관광특구",
  POI003: "명동 관광특구",
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

function all(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return [value];
  return [];
}

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeStatus(status = "보통") {
  const compact = String(status).replace(/\s/g, "");
  if (compact.includes("붐빔") && !compact.includes("약간")) return "붐빔";
  if (compact.includes("약간")) return "약간 붐빔";
  if (compact.includes("여유")) return "여유";
  return "보통";
}

function calculateScore(status) {
  const normalized = normalizeStatus(status);
  if (normalized === "여유") return 92;
  if (normalized === "보통") return 78;
  if (normalized === "약간 붐빔") return 62;
  return 38;
}

function recommendation(status, area) {
  const normalized = normalizeStatus(status);
  if (normalized === "여유") return `${area} 지금 가기 좋아요. 이동 부담이 적고 산책하기도 괜찮아 보여요.`;
  if (normalized === "보통") return `${area} 지금은 무난해요. 인기 구역만 조금 붐빌 수 있어요.`;
  if (normalized === "약간 붐빔") return `${area} 조금 붐벼요. 이동 시간과 대기 시간을 여유 있게 잡는 걸 추천해요.`;
  return `${area} 지금은 많이 붐벼요. 꼭 가야 한다면 이동 시간과 웨이팅을 넉넉히 잡아야 해요.`;
}

function unwrapCityData(json) {
  const root =
    json?.["SeoulRtd.citydata"] ||
    json?.SeoulRtd?.citydata ||
    json?.citydata ||
    json;

  if (root?.RESULT?.CODE && root.RESULT.CODE !== "INFO-000") {
    const message = root.RESULT.MESSAGE || "서울시 API 오류가 발생했어요.";
    const error = new Error(message);
    error.code = root.RESULT.CODE;
    throw error;
  }

  return root?.CITYDATA || root?.citydata || root || {};
}

function parseCityData(json, requestedPoi) {
  const city = unwrapCityData(json);

  const live = first(city?.LIVE_PPLTN_STTS?.LIVE_PPLTN_STTS || city?.LIVE_PPLTN_STTS);
  const weather = first(city?.WEATHER_STTS?.WEATHER_STTS || city?.WEATHER_STTS);
  const bike = first(city?.BIKE_STTS?.BIKE_STTS || city?.BIKE_STTS);
  const subwayList = all(city?.SUB_STTS?.SUB_STTS || city?.SUB_STTS);
  const busList = all(city?.BUS_STN_STTS?.BUS_STN_STTS || city?.BUS_STN_STTS);
  const eventList = all(city?.EVENT_STTS?.EVENT_STTS || city?.EVENT_STTS);
  const road = first(city?.ROAD_TRAFFIC_STTS?.ROAD_TRAFFIC_STTS || city?.ROAD_TRAFFIC_STTS);

  const area = city?.AREA_NM || live?.AREA_NM || PLACES[requestedPoi] || requestedPoi;
  const congestion = live?.AREA_CONGEST_LVL || live?.AREA_CONGEST_LVL_NM || live?.AREA_CONGEST || "보통";

  const minPopulation = asNumber(live?.AREA_PPLTN_MIN);
  const maxPopulation = asNumber(live?.AREA_PPLTN_MAX);

  const weatherName =
    weather?.WEATHER_NM ||
    weather?.SKY_STTS ||
    weather?.SKY_STTS_NM ||
    "날씨 정보 없음";
  const temp = weather?.TEMP ? `${weather.TEMP}℃` : "기온 정보 없음";
  const pm10 = weather?.PM10_INDEX || weather?.PM10 || "정보 없음";
  const pm25 = weather?.PM25_INDEX || weather?.PM25 || "정보 없음";

  const bikeCount =
    bike?.RENT_BIKE_CNT ||
    bike?.BIKE_CNT ||
    bike?.SBIKE_SPOT_CNT ||
    bike?.PARKING_BIKE_TOT_CNT;

  const subwayNames = subwayList
    .map((item) => item.SUB_STN_NM || item.STN_NM)
    .filter(Boolean)
    .slice(0, 2);

  const busNames = busList
    .map((item) => item.BUS_STN_NM || item.STN_NM)
    .filter(Boolean)
    .slice(0, 2);

  const transitParts = [];
  if (subwayNames.length) transitParts.push(`지하철 ${subwayNames.join(", ")}`);
  if (busNames.length) transitParts.push(`버스 ${busNames.join(", ")}`);
  if (road?.ROAD_TRAFFIC_IDX) transitParts.push(`도로 ${road.ROAD_TRAFFIC_IDX}`);

  const eventNames = eventList
    .map((item) => item.EVENT_NM || item.TITLE)
    .filter(Boolean)
    .slice(0, 2);

  return {
    ok: true,
    poi: requestedPoi,
    area,
    status: normalizeStatus(congestion),
    statusRaw: congestion,
    score: calculateScore(congestion),
    message: live?.AREA_CONGEST_MSG || recommendation(congestion, area),
    population:
      minPopulation !== null && maxPopulation !== null
        ? `${minPopulation.toLocaleString()}명 ~ ${maxPopulation.toLocaleString()}명`
        : "인구 범위 정보 없음",
    populationMin: minPopulation,
    populationMax: maxPopulation,
    time: live?.PPLTN_TIME || city?.PPLTN_TIME || "최근 업데이트",
    weather: `${weatherName} · ${temp}`,
    air: `미세먼지 ${pm10} · 초미세먼지 ${pm25}`,
    transit: transitParts.length ? transitParts.join(" / ") : "교통 정보 없음",
    bike: bikeCount ? `따릉이 ${bikeCount}대` : "따릉이 정보 없음",
    event: eventNames.length ? eventNames.join(" / ") : "행사 정보 없음",
    trend: live?.FCST_YN === "Y" ? "예측 정보 포함" : "현재 기준",
    sourceUpdatedAt: live?.PPLTN_TIME || null
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const key = process.env.SEOUL_API_KEY;
  if (!key) {
    return res.status(500).json({
      ok: false,
      error: "SEOUL_API_KEY 환경변수가 설정되지 않았어요. Vercel Project Settings > Environment Variables에 인증키를 넣어주세요."
    });
  }

  const poi = String(req.query.poi || "POI009").trim();
  if (!PLACES[poi]) {
    return res.status(400).json({
      ok: false,
      error: "지원하지 않는 장소 코드예요.",
      supported: PLACES
    });
  }

  try {
    const url = `http://openapi.seoul.go.kr:8088/${key}/json/citydata/1/5/${encodeURIComponent(poi)}`;
    const apiResponse = await fetch(url, {
      headers: {
        "User-Agent": "seoul-hotplace-live-check/1.0"
      }
    });

    const text = await apiResponse.text();

    if (!apiResponse.ok) {
      return res.status(apiResponse.status).json({
        ok: false,
        error: "서울시 API 호출에 실패했어요.",
        status: apiResponse.status,
        body: text.slice(0, 500)
      });
    }

    let json;
    try {
      json = JSON.parse(text);
    } catch (error) {
      return res.status(502).json({
        ok: false,
        error: "서울시 API 응답을 JSON으로 읽지 못했어요.",
        body: text.slice(0, 500)
      });
    }

    const parsed = parseCityData(json, poi);
    return res.status(200).json(parsed);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || "서버에서 데이터를 불러오지 못했어요.",
      code: error.code || null
    });
  }
};
