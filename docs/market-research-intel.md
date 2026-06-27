# SolarSwarm: Market Research Intelligence

*Gathered: June 27, 2026 | Method: web search across IEA, UN, Kyiv Post, IEEE, Devpost, tech literature*
*Purpose: Pre-demo validation for hackathon July 17-18*

---

## Topic 1: Ukraine Power Outages 2026

**Verdict: VALIDATES the project. The problem is acute, worsening, and IEA-documented.**

### Outage Severity (2026 Actuals)

- **8-20 hours per day** without power depending on region
- **Kyiv peaked at 20 hours/day** during January 2026 frosts (-20°C)
- [Kyiv Post](https://www.kyivpost.com/post/68344): new schedules can mean >16 hours of daily outages
- [HFU.org](https://hfu.org/ukraine-long-term-power-crisis/): 8-12h daily blackouts are the current floor, with 16h+ possible under new scheduling

### Infrastructure Damage

- Available generation capacity: **17.5 GW (2025) → ~11.5 GW (Feb 2026)**
- Total capacity lost over 4 years of war: **43.5 GW**
- Russia's tactic: targeted destruction of distribution substations, sometimes shelling the same substation for consecutive days and striking precisely when repair crews arrive ("scorched earth" documented by UN monitors)

### Civilian Impact

- [UN Human Rights Monitoring Mission](https://ukraine.ohchr.org/en/Energy-attacks-amid-an-unusually-harsh-winter-are-exposing-Ukraine-s-civilians-to-extreme-hardship-UN-human-rights-monitors-say): millions without heat in -20°C (January 2026)
- [UN Women](https://eca.unwomen.org/en/stories/news/2026/02/massive-blackouts-in-ukraine-what-it-means-for-women-and-girls): mass blackouts documented with specific gender impact report
- President Zelensky declared an energy emergency on **January 14, 2026**
- Entire communities left without electricity, water, heating, and communications for 14-16+ hours at a time

### What This Means for the Design

The 4-12h outage assumption in the design doc is **conservative** - real 2026 data shows 8-20h. The 2-day autonomy spec is well justified. The problem statement ("outages can last 4-12+ hours and recur nightly") should be updated to reflect the actual severity.

---

## Topic 2: IEA Policy Alignment

**Verdict: VALIDATES the architecture. SolarSwarm is the engineering implementation of official IEA policy.**

The International Energy Agency's 2026 report [Empowering Ukraine Through a Decentralised Electricity System](https://www.iea.org/reports/empowering-ukraine-through-a-decentralised-electricity-system/executive-summary) states:

> "A decentralised energy network — built around multiple small, localised generation nodes linked together through a meshed grid — offers extensive resilience against Russian attacks."

And:

> "Ukraine's only viable path forward is an urgent transition to distributed generation — the construction of networks of small autonomous power plants and energy storage systems that are far more difficult to destroy."

### IEA Numbers

- Ukraine needs **4 GW/year of new distributed PV until 2030** (24 GW total)
- [EBRD and EU](https://www.ebrd.com/home/news-and-events/news/2026/ebrd-and-eu-strengthen-ukraine-s-energy-security-with-new-solar-.html) announced new solar energy funding for Ukraine (2026)
- [World Economic Forum](https://www.weforum.org/stories/2026/01/frontline-security-energy-lessons-ukraine/): "Smaller, distributed assets are harder to target, quicker to repair, and more capable of stabilizing the grid during emergencies"

### Programs Already Running

- **100SolarSchools** campaign: hybrid solar plants keeping schools open during blackouts
- **50SolarHospitals** campaign: solar resilience for critical healthcare infrastructure
- **Solar Resilience Kits** distributed to households in high-risk areas
- Solar Energy Association of Ukraine (SEAU): 800-850 MW of new solar PV added in 2024

### Pitch Implication

This is the single most powerful framing upgrade available before the demo:

*"The IEA says Ukraine needs distributed solar mesh networks. SolarSwarm is what that looks like at the street intersection level."*

Use IEA language directly. The impact story is institutionally backed, not just a startup thesis.

---

## Topic 3: Solar Street Light Swarm IoT Landscape

**Verdict: VALIDATES the gap. LoRa-MESH is the proven stack; the swarm framing is unclaimed.**

### What Exists

**Commercial products (standalone, no swarm):**
- [Novéa Énergies](https://www.novea-energies.com/en/your-project/solar-powered-street-lamp/) - autonomous solar street lamps, France
- [Sunna Design UP](https://sunna-design.com/en/range-product/up/) - standalone solar street light, Africa-focused
- [Soluxio](https://soluxio.lighting/solar-light-post/) - autonomous solar-powered light posts
- Fonroche SmartLight, EngoPlanet - all standalone, no cross-unit coordination

None of these products use the word "swarm." None coordinate coverage between units. None guarantee coverage during outages.

**LoRa-MESH stack (proven, used for energy efficiency only):**
- [Bosun Lighting](https://www.bosunlighting.com/how-to-design-realize-lora-mesh-iot-solar-street-light-city-project.html): LoRa-MESH solar street light systems, sold as energy efficiency tools
- [Semtech + CITiLIGHT](https://www.semtech.com/company/press/semtech-and-citilight-transform-smart-city-street-lighting-with-lorawan): LoRaWAN solar street light deployments in smart cities
- [AGC Lighting](https://www.agcled.com/blog/lorawan-enables-smart-street-lighting.html): LoRaWAN covers up to 15km, peer-to-peer relay eliminates dead zones
- [Robustel](https://www.robustel.store/blogs/industrial-iot-blog/smart-cities-deploying-lorawan-gateways-for-street-lighting-and-waste-management): LoRaWAN gateways for smart city street lighting

Key capability confirmed: LoRa-MESH allows street lights to talk peer-to-peer and relay signals, creating a mesh that extends coverage range. Systems can work if the internet goes down (local RTC + storage). Remote dimming can extend autonomy from 3 to 6 days.

**Academic literature (2024-2025):**
- [IEEE 2024](https://ieeexplore.ieee.org/document/10608473/): LoRaWAN-based street lighting for remote areas with shadow zones
- [MDPI Sensors 2025](https://www.mdpi.com/1424-8220/25/17/5579): Off-grid smart street lighting using LoRaWAN and hybrid renewable energy
- [Springer Nature 2025](https://link.springer.com/article/10.1007/s43926-025-00163-z): IoT and LoRaWAN integration optimizing urban lighting efficiency
- [ResearchGate 2025](https://www.researchgate.net/publication/394183071_IoT-Enabled_Solar-Based_Smart_Street_Lighting_System_Using_ESP32_and_Cloud_Platforms): ESP32 + cloud platform solar street lighting

### The Gap

The LoRa-MESH + solar stack exists and works. What does NOT exist:
- Swarm coordination framing for **emergency coverage guarantee**
- Cross-unit relay algorithm (baton pass) prioritizing coverage continuity over energy efficiency
- Emergency resilience positioning (vs. smart city energy savings)

SolarSwarm is not competing with these products on energy efficiency. It is claiming an entirely different value proposition: **guaranteed illumination during grid failure**. That positioning is unclaimed.

---

## Topic 4: SolarSwarm Name and Concept Uniqueness

**Verdict: CLEAR. No competing project uses this name or this concept.**

Searched: "SolarSwarm", "swarm street lighting", "solar swarm IoT coordination", "autonomous street lighting mesh coverage guarantee"

Results:
- No product, startup, GitHub project, or academic paper named "SolarSwarm" was found
- No project framing street light coordination as "swarm" behavior was found
- No project positioning solar street lights as emergency coverage infrastructure (rather than smart city efficiency) was found

**The name is yours. The emergency resilience framing is yours.**

---

## Topic 5: Smart City Hackathon Intelligence (July 17-18 Demo)

**Verdict: VALIDATES the demo approach. SolarSwarm avoids every overdone pattern and hits every winning criterion.**

### What Is Overdone (Avoid in Framing)

Per analysis of 2025-2026 smart city hackathon patterns and judge feedback:
- Traffic and parking apps
- Smart dustbins and waste management dashboards
- Generic air quality monitors
- Energy "monitoring" dashboards without automated response
- Solutions described only as "smart" without a specific crisis hook

[Smart Cities World](https://www.smartcitiesworld.net/opinions/smart-cities-overpromised-and-under-delivered): city managers say "smart city" has become an overused buzzword for standard applications. Judges have seen it all.

### What Wins

**[AI Autonomous Smart City Hackathon 2026](https://ai-smart-city-2026.devpost.com/) judging rubric:**

| Criterion | Weight | SolarSwarm Fit |
|---|---|---|
| Innovation | 25% | Novel framing (emergency swarm, not efficiency tool) |
| Technical Implementation | 25% | Working LoRa + ESP32 + swarm algorithm |
| Impact | 20% | IEA-backed crisis with documented civilian harm |
| Feasibility | 15% | Real BOM, deployable in days, LoRa stack proven |
| Presentation | 15% | Live baton-pass demo is viscerally compelling |

**[IOT Data Hackathon 2026 winner](https://www.prnewswire.com/apac/news-releases/iot-data-hackathon-2026-winners-announced-mtr-newcomers-score-triple-victory-muhk-team-sweeps-four-awards-302744547.html) (MUHK team, swept 4 awards):** Supply Chain System with automated risk response - not monitoring, but automated action. Judges rewarded the automated response loop, not the dashboard.

**Hardware demo principle:** Judges explicitly reward tangible, deployable solutions over theoretical concepts. A working physical unit plus live dashboard beats a polished slide deck. The hybrid approach (1 physical + 3 simulated) is sufficient - label them clearly.

### Demo Execution Notes

- Practice the **baton-pass moment** 5 times before presenting
- The relay should be **visible within 10 seconds** of the grid-cut event: LED dims on Unit 1, ramps on Unit 2, dashboard updates
- Have a pre-prepared answer for "does it work with 4 real units?" - yes, describe the Approach B full pilot path
- Lead the pitch with the IEA quote, not with the technology - the problem is the hook, the swarm is the solution

---

## Summary: Signal vs. Threat Table

| Signal | Validates or Threatens | Confidence |
|---|---|---|
| Ukraine outages are 8-20h/day (worse than assumed) | **VALIDATES** - spec is conservative, not overkill | High - IEA + UN + Kyiv Post |
| IEA explicitly recommends distributed solar mesh | **VALIDATES** - project is policy-aligned | High - official IEA report |
| No "SolarSwarm" or swarm street lighting project exists | **VALIDATES** - name and concept are clear | High - comprehensive search |
| LoRa-MESH tech is proven commercially | **VALIDATES** - de-risks the architecture | High - multiple vendors |
| Smart city hackathons are tired of dashboard-only demos | **VALIDATES** - SolarSwarm has hardware + automated response | Medium - inferred from 2026 winner patterns |
| Existing vendors sell standalone solar lights | **VALIDATES** - the gap is real and unaddressed commercially | High - product survey |

No threats found. The concept, name, and positioning are clear of the field.
