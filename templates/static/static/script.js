
document.getElementById("riskForm").addEventListener("submit", async function (event) {
    event.preventDefault();

    const crop = document.getElementById("crop").value;
    const temperature = document.getElementById("temperature").value;
    const rainfall = document.getElementById("rainfall").value;
    const resultDiv = document.getElementById("result");

    resultDiv.innerHTML = "<p>🌍 Analyzing climate conditions...</p>";

    try {
        const response = await fetch("/api/analyze", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                crop: crop,
                temperature: temperature,
                rainfall: rainfall
            })
        });

        const data = await response.json();

        let riskClass = "risk-low";
        let riskEmoji = "🟢";

        if (data.risk_level === "HIGH") {
            riskClass = "risk-high";
            riskEmoji = "🔴";
        } else if (data.risk_level === "MEDIUM") {
            riskClass = "risk-medium";
            riskEmoji = "🟡";
        }

        resultDiv.innerHTML = `
            <div class="result-card">
                <h3>🌾 Climate Analysis Results</h3>
                <h2 class="${riskClass}">
                    ${riskEmoji} ${data.risk_level} RISK
                </h2>

                <p><strong>Crop:</strong> ${data.crop}</p>

                <h3>⚠️ Detected Risks</h3>
                <ul>
                    ${data.risks.map(risk => `<li>${risk}</li>`).join("")}
                </ul>

                <h3>🛡️ Recommended Actions</h3>
                <ul>
                    ${data.recommendations.map(item => `<li>${item}</li>`).join("")}
                </ul>
            </div>
        `;

    } catch (error) {
        resultDiv.innerHTML = `
            <div class="result-card">
                <h3>❌ Unable to analyze</h3>
                <p>Please start the FarmShield AI server and try again.</p>
            </div>
        `;
    }
});
