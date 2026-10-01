from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def test_regions_include_required_countries_and_simulation_label():
    response = client.get("/api/regions")
    assert response.status_code == 200
    body = response.json()
    assert body["data_origin"] == "mixed"
    codes = {region["code"] for region in body["regions"]}
    for code in ["FRA", "ESP", "PRT", "DEU", "ITA", "MAR", "GBR", "SWE", "NOR", "POL", "GRC", "NLD"]:
        assert code in codes


def test_unknown_region_is_not_filled_with_zeros():
    response = client.get("/api/risk/ZZZ")
    assert response.status_code == 404
    assert "NO DATA AVAILABLE" in response.json()["detail"]


def test_map_and_profile_follow_the_selected_period():
    early = client.get("/api/risk/ESP", params={"start": 1980, "end": 2000}).json()
    recent = client.get("/api/risk/ESP", params={"start": 2005, "end": 2025}).json()
    assert recent["metrics"]["heat_days"]["period_mean"] > early["metrics"]["heat_days"]["period_mean"]
    mapped = client.get("/api/risk/map", params={"hazard": "heat", "year": 2024, "mode": "absolute"})
    assert mapped.status_code == 200
    assert mapped.json()["values"]["ESP"] is not None


def test_greenland_gaps_remain_null():
    bootstrap = client.get("/api/bootstrap").json()
    coverage = bootstrap["series"]["GRL"]["coverage"]
    year = bootstrap["years"][coverage.index(0)]
    mapped = client.get("/api/risk/map", params={"hazard": "heat", "year": year}).json()
    assert mapped["values"]["GRL"] is None
    assert mapped["values"]["GRL"] != 0


def test_narrow_baseline_does_not_invent_an_anomaly():
    body = client.get("/api/risk/FRA", params={"baseline_start": 2022, "baseline_end": 2024}).json()
    assert body["metrics"]["temperature"]["baseline_mean"] is None
    assert body["metrics"]["temperature"]["anomaly"] is None


def test_compare_limit_and_trend_endpoint():
    too_many = client.get("/api/compare", params={"regions": "FRA,ESP,MAR,SWE,DEU", "hazard": "heat"})
    assert too_many.status_code == 400
    trend = client.get("/api/trends/FRA/heat", params={"start": 1980, "end": 2025})
    assert trend.status_code == 200
    body = trend.json()
    assert body["trend"]["sufficient"] is True
    assert len(body["points"]) == 46
    assert any(point["rolling"] is None for point in body["points"][:4])


def test_hotspots_are_ranked_and_investigation_stays_descriptive():
    hotspots = client.get("/api/hotspots", params={"year": 2025, "limit": 6}).json()
    scores = [item["score"] for item in hotspots["hotspots"]]
    assert scores == sorted(scores, reverse=True)
    assert len(scores) == 6
    story = client.get("/api/investigation/ESP", params={"hazard": "heat", "start": 2005, "end": 2025}).json()
    text = str(story).lower()
    assert story["data_origin"] == "mixed"
    assert "simulated" in text
    assert "heatwave" not in text
    assert "caused by" not in text
    assert story["steps"]


def test_france_temperature_comes_from_the_observed_series():
    body = client.get("/api/risk/FRA", params={"year": 2025, "start": 2005, "end": 2025}).json()
    temperature = body["metrics"]["temperature"]["current"]
    assert temperature is not None
    assert 8 < temperature < 20
    assert body["data_origin"] == "mixed"


def test_invalid_hazard_and_reversed_period():
    assert client.get("/api/trends/FRA/hail").status_code == 400
    assert client.get("/api/risk/FRA", params={"start": 2020, "end": 2000}).status_code == 400
