
const riskForm = document.getElementById("riskForm");
const resultDiv = document.getElementById("result");

const searchButton = document.getElementById("searchLocationBtn");
const gpsButton = document.getElementById("gpsButton");
const locationInput = document.getElementById("locationSearch");

const locationResults = document.getElementById("locationResults");
const weatherResult = document.getElementById("weatherResult");

const temperatureInput = document.getElementById("temperature");
const rainfallInput = document.getElementById("rainfall");
const humidity = weatherResult.dataset.humidity || null;

// 1. SEARCH CITY OR VILLAGE

searchButton.addEventListener("click", searchLocation);

locationInput.addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        searchLocation();
    }
});

async function searchLocation() {

    const place = locationInput.value.trim();

    if (place.length < 2) {
        locationResults.textContent =
            "Please enter at least two characters.";
        return;
    }

    searchButton.disabled = true;
    locationResults.textContent = "Searching locations...";

    try {

        const response = await fetch(
            `/api/geocode?q=${encodeURIComponent(place)}`
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Location search failed.");
        }

        locationResults.innerHTML = "";

        if (!data.locations || data.locations.length === 0) {
            locationResults.textContent = "No locations found.";
            return;
        }

        const list = document.createElement("div");
        list.className = "location-list";

        data.locations.forEach(location => {

            const button = document.createElement("button");

            button.type = "button";
            button.className = "location-option";

            button.textContent =
                `${location.name}, ${location.admin1 || ""}, ${location.country || ""}`;

            button.addEventListener("click", function() {
                getWeather(
                    location.latitude,
                    location.longitude,
                    button.textContent
                );
            });

            list.appendChild(button);

        });

        locationResults.appendChild(list);

    } catch (error) {

        locationResults.textContent = error.message;

    } finally {

        searchButton.disabled = false;

    }
}


// 2. AUTOMATIC GPS LOCATION

gpsButton.addEventListener("click", function() {

    if (!navigator.geolocation) {
        weatherResult.textContent =
            "Your browser does not support GPS location.";
        return;
    }

    gpsButton.disabled = true;
    weatherResult.textContent = "Detecting your location...";

    navigator.geolocation.getCurrentPosition(

        async function(position) {

            await getWeather(
                position.coords.latitude,
                position.coords.longitude,
                "Your current GPS location"
            );

            gpsButton.disabled = false;

        },

        function(error) {

            const messages = {
                1: "Location permission denied. Please allow location access.",
                2: "Your location is currently unavailable.",
                3: "GPS request timed out. Please try again."
            };

            weatherResult.textContent =
                messages[error.code] || "Unable to detect your location.";

            gpsButton.disabled = false;

        },

        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 300000
        }

    );

});


// 3. FETCH LIVE WEATHER

async function getWeather(latitude, longitude, locationName) {

    weatherResult.textContent = "Fetching weather information...";

    try {

        const response = await fetch(
            `/api/weather?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Weather request failed.");
        }

        if (
            !Number.isFinite(Number(data.temperature)) ||
            !Number.isFinite(Number(data.daily_rainfall))
        ) {
            throw new Error("Weather data is incomplete.");
        }

        // Automatically fill analyzer inputs
        temperatureInput.value = data.temperature;
        weatherResult.dataset.humidity = data.humidity ?? "";
        rainfallInput.value = data.daily_rainfall;

        weatherResult.innerHTML = `
            <div class="weather-card">

                <h3>📍 ${locationName}</h3>

                <div class="weather-grid">

                    <div class="weather-item">
                        <small>🌡️ Temperature</small>
                        <strong>${data.temperature} °C</strong>
                    </div>

                    <div class="weather-item">
                        <small>💧 Humidity</small>
                        <strong>${data.humidity}%</strong>
                    </div>

                    <div class="weather-item">
                        <small>🌧️ Daily Rainfall Forecast</small>
                        <strong>${data.daily_rainfall} mm</strong>
                    </div>

                    <div class="weather-item">
                        <small>💨 Wind Speed</small>
                        <strong>${data.wind_speed} km/h</strong>
                    </div>

                </div>

                <p class="weather-note">
                    Weather date: ${data.date || "Not available"}.
                    ${data.rainfall_note || ""}
                </p>

                <p style="color:#218c55; margin-top:12px; font-size:13px;">
                    ✓ Weather loaded. Your analyzer inputs have been updated.
                </p>

            </div>
        `;

        locationResults.innerHTML = "";

    } catch (error) {

        weatherResult.textContent = error.message;

    }

}


// 4. EXISTING CROP RISK ANALYZER

riskForm.addEventListener("submit", async function(event) {

    event.preventDefault();

    const crop = document.getElementById("crop").value;
    const temperature = temperatureInput.value;
    const rainfall = rainfallInput.value;

    if (!crop || temperature === "" || rainfall === "") {
        resultDiv.textContent = "Please complete all fields.";
        return;
    }

    const analyzeButton = riskForm.querySelector(
        'button[type="submit"]'
    );

    analyzeButton.disabled = true;
    resultDiv.textContent = "🌍 Analyzing climate conditions...";

    try {

        const response = await fetch("/api/analyze", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },
body: JSON.stringify({
    crop: crop,
    temperature: temperature,
    rainfall: rainfall,
    humidity: humidity
})

        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Analysis failed.");
        }

        let emoji = "🟢";
        let riskClass = "risk-low";

        if (data.risk_level === "HIGH") {
            emoji = "🔴";
            riskClass = "risk-high";
        } else if (data.risk_level === "MEDIUM") {
            emoji = "🟡";
            riskClass = "risk-medium";
        }

        const card = document.createElement("div");
        card.className = "result-card";

        const heading = document.createElement("h3");
        heading.textContent = "🌾 Climate Analysis Result";

        const risk = document.createElement("h2");
        risk.className = riskClass;
        risk.textContent = `${emoji} ${data.risk_level} RISK`;
        const scoreText = document.createElement("h3");
scoreText.textContent = `Climate Risk Score: ${data.risk_score}/100`;

const factorsHeading = document.createElement("h3");
factorsHeading.textContent = "📊 Risk Factors";

const factorsList = document.createElement("ul");

(data.risk_factors || []).forEach(item => {
    const li = document.createElement("li");
    li.textContent = item;
    factorsList.appendChild(li);
});

        const cropText = document.createElement("p");
        cropText.textContent = `Crop: ${data.crop}`;

        const riskHeading = document.createElement("h3");
        riskHeading.textContent = "⚠️ Detected Risks";

        const riskList = document.createElement("ul");

        data.risks.forEach(item => {
            const li = document.createElement("li");
            li.textContent = item;
            riskList.appendChild(li);
        });

        const actionHeading = document.createElement("h3");
        actionHeading.textContent = "🛡️ Recommended Actions";

        const actionList = document.createElement("ul");

        data.recommendations.forEach(item => {
            const li = document.createElement("li");
            li.textContent = item;
            actionList.appendChild(li);
        });

        card.append(
            heading,
            risk,
            cropText,
            scoreText,
    cropText,
    factorsHeading,
    factorsList,
            riskHeading,
            riskList,
            actionHeading,
            actionList
        );

        resultDiv.replaceChildren(card);

    } catch (error) {

        resultDiv.textContent = "❌ " + error.message;

    } finally {

        analyzeButton.disabled = false;

    }

});
