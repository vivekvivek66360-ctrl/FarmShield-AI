
from flask import Flask, render_template, request, jsonify
import requests
import math

app = Flask(__name__)

GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
WEATHER_URL = "https://api.open-meteo.com/v1/forecast"

# Demonstration thresholds only.
# Validate these against local agricultural guidance before real-world use.
CROP_PROFILES = {
    "rice": {"heat_warning": 32, "heat_high": 38},
    "tomato": {"heat_warning": 30, "heat_high": 35},
    "wheat": {"heat_warning": 28, "heat_high": 34},
    "maize": {"heat_warning": 32, "heat_high": 38},
    "cotton": {"heat_warning": 35, "heat_high": 40},
    "sugarcane": {"heat_warning": 35, "heat_high": 40}
}


def analyze_risk(crop, temperature, rainfall, humidity=None):

    crop_key = crop.strip().lower()

    profile = CROP_PROFILES.get(
        crop_key,
        {"heat_warning": 32, "heat_high": 38}
    )

    score = 0
    risks = []
    recommendations = []
    factors = []

    # 1. CROP-SPECIFIC HEAT RISK

    if temperature >= profile["heat_high"]:
        score += 40
        risks.append("Severe heat warning for the selected crop.")
        recommendations.append(
            "Check for heat stress symptoms and consult local "
            "agricultural guidance about protective measures."
        )
        factors.append("Severe crop-specific heat indicator")

    elif temperature >= profile["heat_warning"]:
        score += 20
        risks.append("Elevated temperature may stress this crop.")
        recommendations.append(
            "Monitor the crop for heat stress, especially during "
            "the hottest part of the day."
        )
        factors.append("Moderate crop-specific heat indicator")

    # 2. DAILY PRECIPITATION INDICATORS
    # This is daily precipitation, not a long-term drought measurement.

    if rainfall >= 50:
        score += 40
        risks.append("High daily precipitation indicator.")
        recommendations.append(
            "Check field drainage and inspect for standing water "
            "or waterlogging."
        )
        factors.append("High daily precipitation")

    elif rainfall <= 0.5:
        score += 10
        risks.append("Very low daily precipitation.")
        recommendations.append(
            "Check soil moisture before deciding whether irrigation "
            "is needed."
        )
        factors.append("Very low daily precipitation")

    # 3. HUMIDITY INDICATOR

    if humidity is not None and humidity >= 85 and temperature >= 25:
        score += 20
        risks.append(
            "Warm and humid conditions may increase disease pressure."
        )
        recommendations.append(
            "Inspect leaves and stems for signs of disease. "
            "Seek local crop-protection guidance if symptoms appear."
        )
        factors.append("High humidity with warm conditions")

    # 4. FINAL SCORE

    score = min(score, 100)

    if score >= 50:
        risk_level = "HIGH"
    elif score >= 20:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    if not risks:
        risks.append("No major warning indicators detected.")
        recommendations.append(
            "Continue monitoring weather and crop conditions."
        )
        factors.append("No configured warning indicators")

    return {
        "crop": crop,
        "risk_level": risk_level,
        "risk_score": score,
        "risks": risks,
        "recommendations": recommendations,
        "risk_factors": factors,
        "model_note": (
            "Prototype scoring model. Thresholds and weights are "
            "demonstration values, not validated crop-specific advice."
        )
    }


@app.route("/")
def home():
    return render_template("index.html")


# CLIMATE RISK API

@app.route("/api/analyze", methods=["POST"])
def analyze():

    try:
        data = request.get_json(silent=True)

        if not isinstance(data, dict):
            return jsonify({"error": "Please provide valid JSON data."}), 400

        crop = str(data.get("crop", "")).strip()

        if not crop:
            return jsonify({"error": "Please select a crop."}), 400

        temperature = float(data.get("temperature"))
        rainfall = float(data.get("rainfall"))

        humidity_value = data.get("humidity")
        humidity = None if humidity_value in (None, "") else float(humidity_value)

        if not math.isfinite(temperature) or not math.isfinite(rainfall):
            return jsonify({"error": "Invalid numeric values."}), 400

        if humidity is not None and not math.isfinite(humidity):
            return jsonify({"error": "Invalid humidity value."}), 400

        if not -50 <= temperature <= 60:
            return jsonify({"error": "Temperature must be between -50 and 60 °C."}), 400

        if not 0 <= rainfall <= 1000:
            return jsonify({"error": "Daily precipitation must be between 0 and 1000 mm."}), 400

        if humidity is not None and not 0 <= humidity <= 100:
            return jsonify({"error": "Humidity must be between 0 and 100%."}), 400

        result = analyze_risk(crop, temperature, rainfall, humidity)
        return jsonify(result)

    except (TypeError, ValueError):
        return jsonify({
            "error": "Temperature, rainfall and humidity must be valid numbers."
        }), 400

    except Exception:
        app.logger.exception("Climate analysis failed")
        return jsonify({"error": "Climate analysis failed."}), 500


# CITY AND VILLAGE SEARCH

@app.route("/api/geocode", methods=["GET"])
def geocode():

    place = request.args.get("q", "").strip()

    if len(place) < 2:
        return jsonify({"error": "Enter at least two characters."}), 400

    try:
        response = requests.get(
            GEOCODING_URL,
            params={
                "name": place,
                "count": 5,
                "language": "en",
                "format": "json"
            },
            timeout=15
        )

        response.raise_for_status()
        data = response.json()

        locations = []

        for item in data.get("results", []):
            locations.append({
                "name": item.get("name"),
                "admin1": item.get("admin1", ""),
                "country": item.get("country", ""),
                "latitude": item.get("latitude"),
                "longitude": item.get("longitude")
            })

        return jsonify({"locations": locations})

    except requests.RequestException:
        app.logger.exception("Location search failed")
        return jsonify({"error": "Unable to search locations right now."}), 502


# LIVE WEATHER

@app.route("/api/weather", methods=["GET"])
def weather():

    try:
        latitude = float(request.args.get("lat"))
        longitude = float(request.args.get("lon"))

        if not math.isfinite(latitude) or not math.isfinite(longitude):
            return jsonify({"error": "Invalid GPS coordinates."}), 400

        if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
            return jsonify({"error": "GPS coordinates are out of range."}), 400

        response = requests.get(
            WEATHER_URL,
            params={
                "latitude": latitude,
                "longitude": longitude,
                "current": (
                    "temperature_2m,precipitation,"
                    "relative_humidity_2m,wind_speed_10m,weather_code"
                ),
                "daily": (
                    "precipitation_sum,"
                    "temperature_2m_max,"
                    "temperature_2m_min"
                ),
                "timezone": "auto",
                "forecast_days": 1
            },
            timeout=20
        )

        response.raise_for_status()
        data = response.json()

        current = data.get("current", {})
        daily = data.get("daily", {})

        if not current or not daily.get("precipitation_sum"):
            return jsonify({"error": "Weather data is unavailable."}), 502

        return jsonify({
            "temperature": current.get("temperature_2m"),
            "current_precipitation": current.get("precipitation"),
            "daily_rainfall": daily["precipitation_sum"][0],
            "humidity": current.get("relative_humidity_2m"),
            "wind_speed": current.get("wind_speed_10m"),
            "weather_code": current.get("weather_code"),
            "date": daily.get("time", [None])[0],
            "timezone": data.get("timezone"),
            "rainfall_note": (
                "Daily precipitation is a forecast estimate, "
                "not a rainfall gauge measurement."
            )
        })

    except (TypeError, ValueError):
        return jsonify({
            "error": "Valid latitude and longitude are required."
        }), 400

    except requests.RequestException:
        app.logger.exception("Weather service request failed")
        return jsonify({
            "error": "Unable to retrieve weather data right now."
        }), 502

    except Exception:
        app.logger.exception("Weather processing failed")
        return jsonify({"error": "Weather processing failed."}), 500


if __name__ == "__main__":
    app.run(debug=True)
