from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

def analyze_risk(crop, temperature, rainfall):
    risks = []
    recommendations = []

    if temperature >= 38:
        risks.append("High Heat Risk")
        recommendations.append("Provide shade and irrigate during cooler hours.")
    elif temperature >= 32:
        risks.append("Moderate Heat Risk")
        recommendations.append("Monitor crops for heat stress.")

    if rainfall >= 150:
        risks.append("Heavy Rain / Flood Risk")
        recommendations.append("Ensure proper drainage and protect crops from waterlogging.")
    elif rainfall <= 20:
        risks.append("Low Rainfall Risk")
        recommendations.append("Consider irrigation and conserve soil moisture.")

    if not risks:
        risks.append("Low Climate Risk")
        recommendations.append("Weather conditions appear relatively favorable. Continue monitoring.")

    risk_level = "LOW"

    if any("High" in r or "Flood" in r for r in risks):
        risk_level = "HIGH"
    elif len(risks) > 1 or any("Moderate" in r for r in risks):
        risk_level = "MEDIUM"

    return {
        "crop": crop,
        "risk_level": risk_level,
        "risks": risks,
        "recommendations": recommendations
    }

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/api/analyze", methods=["POST"])
def analyze():
    data = request.get_json()

    result = analyze_risk(
        data["crop"],
        float(data["temperature"]),
        float(data["rainfall"])
    )

    return jsonify(result)

if __name__ == "__main__":
    app.run(debug=True)
