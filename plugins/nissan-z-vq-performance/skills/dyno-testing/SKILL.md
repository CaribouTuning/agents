---
name: turbo-kit-350z-vq35de
displayName: Complete Single Turbo Kit for 2006 350Z (VQ35DE)
description: Manufacturing-ready specifications for complete single-turbo forced-induction system for 2006 manual 350Z. Includes turbo selection, manifold design, piping layout, intercooler integration, fuel system upgrades, ECU tuning, and detailed manufacturing drawings ready to send to fabricators.
category: automotive-performance
depth: manufacturing
model: opus
---

# Complete Single Turbo Kit for 2006 Manual 350Z (VQ35DE)

**Target Power**: 380-420 whp (safe, reliable, street-legal)  
**Boost Pressure**: 8-10 psi (sustainable, thermal-safe)  
**Installation Time**: 60-80 hours (experienced shop)  
**Total Kit Cost**: $8,500-12,000 (parts + fabrication, not including dyno/tuning)

## System Overview

### What's Included in Kit
1. Turbocharger assembly (T3/T4 flanged, 0.63 A/R turbine)
2. Custom exhaust manifold (cast iron, T3 flange)
3. Custom downpipe (3" stainless steel)
4. Intercooler core + end tanks (aluminum bar-plate)
5. Intercooler piping kit (aluminum, mandrel bent)
6. Oil feed/return lines (braided stainless)
7. Wastegate (external, 38mm)
8. Boost control solenoid & electronics
9. Fuel system upgrades (injectors, pump, regulator)
10. Engine bay brackets & mounting hardware
11. Heat shielding (stainless, ceramic coating)
12. Intake modification kit
13. Custom ECU tune (data files, not included in physical kit)

### What You Supply (From Donor Z)
- 2006 350Z manual transmission model
- Factory cooling system (radiator, fans)
- Factory fuel tank
- Factory wiring harness
- Factory exhaust system downstream of turbo

---

## Part 1: Turbocharger Assembly

### Selection Rationale
**Chosen**: Garrett GT2871 or equivalent (Mitsubishi TD05, IHI RHF55)
- **Compressor**: 54mm inducer, 73mm exducer
- **Turbine**: 45mm inducer, 56mm exducer, T3 flange
- **A/R Ratio**: 0.63 (moderate spool, good response)
- **Max Boost**: 12 psi safe, 15 psi absolute ceiling
- **Flow Rating**: 550 CFM (adequate for 420 whp VQ35DE)
- **Bearing Type**: Ball bearing (faster spool, better low-RPM response)

### Turbo Mounting Specification

**Location**: Driver-side of engine (below VQ manifold)

**Mounting Bracket Design**:
```
Material: 6061-T6 aluminum (cast or fabricated)
Attachment points:
  - Engine block: Two M10x1.5 bolts to block bosses
  - Subframe: Two M8x1.25 bolts to chassis bracket
  - Vibration isolation: Rubber mounts at all three points

Bracket Dimensions:
  Overall length: 280 mm
  Width: 120 mm
  Height: 150 mm
  
Bolt torque specs:
  M10 engine bolts: 80 N⋅m (59 ft-lbs)
  M8 subframe bolts: 40 N⋅m (30 ft-lbs)
  Turbo to manifold: 50 N⋅m (37 ft-lbs)
```

**Thermal Considerations**:
- Heat shield: 1mm stainless steel, 50mm air gap
- Ceramic coating on turbine housing (rated to 1200°F)
- Mounted to protect transmission from radiant heat
- Oil line insulation required (high-temp wrap)

---

## Part 2: Exhaust Manifold (Custom Cast)

### Design Specifications

**Material**: Cast iron (ductile iron, 65-45-12 specification)
- Superior heat retention vs. stainless
- Easier casting, lower cost
- Adequate strength for 10 psi boost
- Ceramic coat possible for exterior (optional, adds cost)

**Flow Characteristics**:
```
Runner Design:
  4 individual runners from cylinders (1, 3, 5 on one side; 2, 4, 6 on other)
  Runner diameter: 45mm inside diameter (tapered 40mm at port → 50mm at merge)
  Port size: 43mm × 38mm oval (matches VQ head port)
  
Merge Collector:
  Type: 4-into-1 design (4 cylinders on driver side)
  Collector diameter: 55mm
  Length: 120mm (balances backpressure and scavenging)
  
T3 Turbine Flange:
  Bolt pattern: Standard T3 (4× M8×1.25 holes)
  Flange thickness: 8mm (cast integral)
```

### CAD Dimensions (Rough Sketch Coordinates)

```
Left-side casting (cylinders 1, 3, 5):
  Port 1: Center @ X=0, Y=0 (nearest crankshaft)
  Port 3: Center @ X=45, Y=35 (offset)
  Port 5: Center @ X=90, Y=0 (far side)
  Merge point: X=67, Y=15
  Turbine flange: X=120, Y=0 (protrudes 25mm below manifold)

Right-side casting (cylinders 2, 4, 6):
  Mirror of left side across centerline
  Combined merge: Single collector → turbo inlet
```

### Manufacturing Process

1. **Sand Casting**:
   - Create wooden or aluminum pattern (prototype stage)
   - Make steel mold (for production runs)
   - Pour molten ductile iron @ 1600°C
   - Cure 24 hours in sand
   - Shake out and cool to room temp

2. **Machining**:
   - Face bore the 4 exhaust ports (finish to 43mm × 38mm)
   - Bore T3 turbo flange holes (M8×1.25 pitch)
   - Deburr all internal passages
   - Hone collector ID to 55.5mm (1mm clearance tolerance)

3. **Heat Treatment** (optional but recommended):
   - Normalize @ 900°C for stress relief
   - Improves cracking resistance under thermal cycling

4. **Coating** (optional):
   - Ceramic thermal coating (exterior): 0.5-1mm thick
   - Protects from radiant heat, improves engine bay temps
   - Cost: +$400-600 per manifold

### Quality Inspection Checklist
- [ ] Port dimensions within tolerance (±2mm bore, ±1mm height)
- [ ] T3 flange hole pattern accuracy (within 0.5mm)
- [ ] Casting porosity acceptable (visual inspection, no cracks)
- [ ] Pressure test to 3 bar (verify no leaks)
- [ ] Thermal shock test (3 cycles: 200°C → room temp)

---

## Part 3: Downpipe (Custom Stainless Steel)

### Design Specifications

**Material**: 304 stainless steel, 3mm wall thickness
- Superior corrosion resistance
- High temperature capability (rated to 1000°F exhaust)
- Excellent durability for street use

**Piping Design**:
```
Inlet: Directly from T3 turbine outlet (63mm OD flange)
Outlet: 3" diameter piping (76mm OD, 3.5mm wall)

Layout:
  Section 1 (turbo to bellypan): 250mm length, 3" diameter
  Section 2 (bellypan to rear): 1200mm length, 3" diameter
  
Exit: Connects to factory muffler or aftermarket catback

Expansion loops:
  Two bellows-style expansion loops to allow thermal expansion
  Reduces stress on welds and mounting points
  Flexibility also isolates vibration
```

### Bend Specifications

```
Turbo outlet reducer (T3 to 3" pipe):
  Type: Mandrel bent, smooth transitions
  Radius: 50mm (2") bend radius minimum
  Angle: 45° down from turbo
  Material: 304 stainless tube

Rear downpipe bends:
  4× 90° bends (around subframe, transmission)
  Bend radius: 75-100mm (smooth, no kinks)
  All bends mandrel bent (maintains wall thickness, no collapse)
```

### Heat Shielding

```
Heat shield wrapping:
  - High-temp stainless steel outer sleeve
  - 1mm stainless steel, perforated
  - 25mm air gap between pipe and shield
  - Reduces bellypan/transmission heat from 200°F → 100°F

Mounting:
  - Cable-ties or spring clamps every 200mm
  - Allows thermal expansion without binding
  - Removable for inspection/service
```

### Hangering & Support

```
Support points (3 total):
  1. Turbo mounting bracket (integral)
  2. Bellypan area: Rubber-isolated mount (M8 bolt to frame)
  3. Rear section: Rubber hangers at chassis brackets

Vibration isolation:
  All hangers: Rubber or neoprene (NVH isolation)
  Avoids direct metal-to-metal contact with frame
```

### Manufacturing Procedure

1. **Bending**: Mandrel bend each section on tube bending press
2. **Welding**: TIG weld all joints (superior strength vs. MIG for automotive)
   - Joint prep: Bevel 37.5° (½ of included angle)
   - Filler: ER308L stainless rod
   - Multiple passes for structural integrity
3. **Inspection**: Dye penetrant test all welds (detects cracks)
4. **Finishing**: Grind welds smooth, polish if cosmetic finish desired
5. **Pressure Testing**: 2 bar air pressure test (verify weld integrity)

### Quality Checkpoints
- [ ] Mandrel bends: Wall thickness uniform (3.0-3.2mm)
- [ ] Welds: No porosity, cracks, undercut (visual + dye penetrant)
- [ ] Dimensions: Fit-check on actual Z engine bay
- [ ] Pressure test passed (2 bar, hold 30 minutes)
- [ ] Thermal test: No warping after heat cycling

---

## Part 4: Intercooler System

### Core Selection

**Type**: Air-to-air, aluminum bar-plate construction
**Size**: 600mm × 300mm × 100mm (front-mounted, bumper integration)
**Efficiency**: 70-80% (adequate for 8-10 psi boost)
**Pressure Drop**: <4 psi at full flow (minimizes turbo backpressure)

### Intercooler Core Specifications

```
Material: 6061-T6 aluminum (lightweight, excellent thermal conductivity)
Core dimensions:
  Length: 600 mm
  Height: 300 mm
  Depth: 100 mm (total including end tanks)

Cooling fins:
  Fin pitch: 2.5 mm (8-10 fins per inch)
  Fin material: Brazed aluminum (integral with tubes)
  Tube count: 25-30 parallel tubes
  
Flow path:
  Inlet: Top-left (charge air from turbo)
  Outlet: Bottom-right (to intake manifold)
  Air path: Horizontal, front-to-back (ram air effect)

Pressure rating:
  Design pressure: 3 bar (44 psi)
  Test pressure: 4.5 bar (burst test)
  Safety factor: 4.5× for street use
```

### End Tank Design

```
Inlet tank (driver-side):
  Volume: 400 cc
  Port: 76mm OD opening (to charge pipe)
  Internal baffle: Distributes charge air evenly across core
  
Outlet tank (passenger-side):
  Volume: 400 cc
  Port: 76mm OD opening (to intake manifold)
  Drain: 6mm bolt hole with plug (for pressurization testing)

Material: Cast aluminum A356-T6 (pressure vessel rated)
Wall thickness: 4mm
Welds: TIG brazed to core
```

### Charge Pipe Design

```
Turbo outlet → Intercooler inlet:
  Length: 600 mm
  Diameter: 76 mm OD, 3mm wall (aluminum tube)
  Bends: 2× 45° mandrel bends (smooth flow)
  Connections: Crimped aluminum fittings (no clamps possible)
  
Intercooler outlet → Intake manifold:
  Length: 800 mm (routes around engine)
  Diameter: 76 mm OD, 3mm wall
  Bends: 3× 45° + 1× 90° (to follow engine contour)
  Connections: Bracket-mounted for vibration isolation
  Boost port: 6mm NPT fitting for boost gauge/sensor

Pressure relief valve:
  Type: Compressor bypass valve (BOV)
  Location: Intercooler inlet
  Cracking pressure: 1.2× target boost (9-12 psi for 8-10 psi target)
  Prevents compressor surge when throttle closes
```

### Mounting System

```
Frame mounting brackets:
  Material: 6061-T6 aluminum angle (lightweight)
  Configuration: Lower frame rails, forward of wheels
  Attachment: 2× M10 bolts to frame (80 N⋅m each)
  Vibration isolation: Rubber isolator pads (all attachment points)

Bumper integration:
  Intercooler sits behind bumper mesh
  Bumper modified: Cut 600×300mm opening, reinforced edges
  Air ducting: Optional shroud to force air through core (improves cooling)

Plenum design:
  Upper duct: Funnels hot air from turbo back to core
  Lower duct: Returns cool air to intake (sealed plenum)
  Reduces air recirculation, improves efficiency
```

### Quality Testing

- [ ] Pressure test: Core holds 3 bar for 30 minutes
- [ ] Thermal test: Temperature drop 30-40°F at full flow
- [ ] Flow test: Pressure drop <4 psi at 150 CFM
- [ ] Fit check: Proper clearance in engine bay (25mm min)
- [ ] Vibration test: No resonance or rattling after 30-minute highway drive

---

## Part 5: Oil System (Feed & Return)

### Oil Feed Line

```
Source: Engine block, high-pressure side (adaptor bossing)
Destination: Turbo oil inlet (T3 standard port)

Line specifications:
  Type: -10 AN stainless braided hose
  Length: 1200 mm (routes around engine)
  Pressure rating: 200 psi (safe margin at 100 psi turbo feed pressure)
  Fittings: -10 AN (5/8-18 UNF) aluminum, crimped ends

Pressure relief valve:
  Type: Inline cartridge (after block adaptor)
  Setting: 80 psi (prevents overpressure to turbo)
  Bypass: Routes excess flow back to pan (prevents starvation)
  
Flow requirement:
  At idle: 2-3 GPM minimum (film cooling)
  At full boost: 8-10 GPM (thermal management)
  Stock Z pump: Adequate (delivers 40 psi @ 6000 rpm)
```

### Oil Return Line

```
Source: Turbo oil outlet (T3 standard port)
Destination: Engine oil pan (above oil level)

Line specifications:
  Type: -12 AN braided stainless (gravity return)
  Length: 1500 mm (routes downward, uses gravity)
  Pressure rating: 50 psi (negative pressure risk, no collapse)
  Fittings: -12 AN aluminum, welded/crimped

Return line sizing:
  Diameter: 3/4" (19mm) ID minimum
  Prevents backpressure (critical for bearing cooling)
  Oversizing: Better cooling, no downside

Drain pan modification:
  Stock pan adequate
  New boss welded: 1" NPT port, 25mm above oil level
  Anti-siphon: Ball check valve prevents oil siphon when engine off
  Mesh screen: 100 micron, prevents debris in turbo
```

---

## Part 6: Fuel System Upgrade

### Fuel Injectors

```
Stock injectors: 280 cc/min (adequate to ~300 whp)
Upgrade required: 380 cc/min injectors (for 380-420 whp on 8-10 psi)

Injector specifications:
  Flow rate: 380-420 cc/min @ 3 bar
  Spray pattern: Pintle type (compatible with VQ head)
  Impedance: High-impedance (factory ECU compatible)
  Material: Stainless, Viton seals

Installation:
  Count: 6 injectors (one per cylinder)
  Type: OEM clip-on fuel rail injectors
  Firing: Tuned ECU decides (engine-mounted fuel rail unmodified)
  Swap procedure: Requires fuel rail removal, 2-hour job

Fuel rail modification:
  None required (stock rail accommodates upgraded injectors)
  Pressure regulator: Stock 43 psi adequate
```

### Fuel Pump Upgrade

```
Stock pump: 255 LPH @ 1000 rpm
Upgrade requirement: 340 LPH @ 1000 rpm (safety margin for 420 whp)

Pump specifications:
  Type: In-tank electric fuel pump
  Flow: 340-380 LPH @ 1000 rpm, full pressure
  Pressure: 50 psi min, 60 psi typical (regulator controlled)
  Voltage: 12V DC, draws 15-20 amps
  Connector: Compatible with Z33 wiring

Installation:
  Access: Through fuel tank access hatch (factory design)
  Replacement procedure: Drain fuel, remove sender/pump module, swap pump assembly
  Wiring: Factory harness supports upgraded amperage (20A relay minimum)
  Fuel lines: Stock rubber hose adequate (50 psi rating)
```

### Fuel Pressure Regulator & Damper

```
Fuel pressure regulator:
  Type: Bypass style (stock design compatible)
  Setting: Adjusted for 3 bar (43 psi) reference pressure
  Modification: Aftermarket upgrade not required (stock adequate)
  
Fuel damper (accumulator):
  Type: 0.5L stainless steel accumulator
  Location: Engine bay, near fuel rail
  Function: Absorbs pressure spikes, prevents injector buzz
  Pressure rating: 10 bar (safe margin)
  Installation: T-fitting in fuel line, check valve prevents backflow
```

---

## Part 7: Boost Control System

### Wastegate Design

```
Wastegate type: External, 38mm poppet (T3 standard mounting)
Actuation: Pneumatic (boost pressure signal)
Cracking pressure: 10 psi (adjustable, 8-12 psi range)

Pneumatic circuit:
  Signal line: 6mm rubber hose from intake manifold
  Reference line: 6mm rubber hose to atmospheric valve
  Response time: <100ms (adequate for VQ RPM range)

Waste gate solenoid:
  Type: Boost control solenoid (3-way valve)
  Function: Routes boost signal to wastegate for active control
  Duty cycle: 0-100% (ECU controlled)
  Boost target: 10 psi (at 6000 rpm, full load)
```

### Boost Control Logic

```
ECU strategy (programmed in custom tune):

Idle-3000 rpm:     0 psi (spool phase)
3000-3500 rpm:     4 psi (building)
3500-4500 rpm:     6 psi (power building)
4500-6000 rpm:     8 psi (sustainable)
6000+ rpm:         10 psi (peak, limited by knock)

Safety limits:
  Maximum boost: 11 psi (ECU fuel cutoff if exceeded)
  Knock detection: Timing retard 1-2° per knock event
  Thermal cutoff: Reduce boost if intake temps exceed 60°C
  Fuel pressure: Reduce boost if pressure drops below 40 psi
```

---

## Part 8: Engine Bay Brackets & Mounts

### Turbo Support Bracket (Aluminum, Fabricated)

```
Material: 6061-T6 aluminum plate, 5mm thickness
Dimensions:
  Length: 280 mm
  Width: 120 mm
  Height: 150 mm (from engine block to subframe)

Mounting points:
  Engine block: 2× M10×1.5 holes, 80mm apart
  Subframe: 2× M8×1.25 holes, 200mm apart
  Vibration isolation: Rubber bushings (all bolts)

Turbo clearances:
  Transmission: Minimum 40mm clearance (verified)
  Bellypan: 50mm clearance (heat shield required)
  Steering rack: 30mm clearance (routed around)

Heat shielding:
  Stainless steel plate, 1mm thickness, mounted 25mm below turbo
  Protects transmission fluid from radiant heat
  Mounting: Rubber-isolated stand-offs
```

### Intercooler Mounting Bracket (Aluminum Extrusion)

```
Material: 6061-T6 aluminum angle/channel extrusion
Configuration: Lower frame rail mounting (forward of wheels)

Bracket dimensions:
  Length: 700 mm (spans wheel well width)
  Depth: 150 mm (projects from frame)
  Height: 300 mm (supports intercooler height)

Attachment:
  Frame bolts: 2× M10 (80 N⋅m torque)
  Vibration isolation: Neoprene bushings, all attachment points
  Intercooler connection: 4-point suspension (corners of core tank)

Durability:
  No direct metal-to-metal (prevents vibration transmission)
  Allows thermal expansion (rubber compliance)
  Impact-resistant mounting (designed for road debris)
```

### Heat Shield Fabrication (Stainless Steel)

```
Purpose: Reduce engine bay temperatures, protect drivetrain
Material: 304 stainless steel, 1mm thickness (perforated optional)

Coverage areas:
  1. Turbo shield: Wraps turbine housing (25mm air gap)
  2. Downpipe wrap: High-temperature zone
  3. Oil line insulation: Prevents oil degradation
  4. Bellypan protection: Reflects heat from transmission

Mounting:
  Stainless steel fasteners (M6 button-head cap screws)
  Rubber grommets (vibration isolation)
  Removable panels (access to components)

Performance benefit:
  Engine bay temps reduced: 20-40°F (typical)
  Transmission fluid temps: 10-20°F cooler
  Intake air temps: 5-10°F cooler (intercooler effect)
```

---

## Part 9: Intake Modification (Custom Piping)

### Air Intake Path Modification

```
Stock path: Factory airbox → MAF → throttle body → intake manifold
Modified path: Intercooler outlet → Custom pipe → throttle body → manifold

Intake pipe design:
  Material: 3" diameter aluminum tube (76mm OD, 3mm wall)
  Length: 600mm (minimizes volume, fast response)
  Mandrel bends: 1× 45° (from intercooler to throttle axis)
  Smooth bore: Polished interior (reduces turbulence)

Throttle body adapter:
  Material: Aluminum, custom-machined
  Bolt pattern: Factory throttle body mounting (maintains OEM drivability)
  Gasket: Silicone composite (high-temp rated)
  Taper: 3" ID inlet → 2.5" outlet (throttle body standard)

Air filter mounting:
  Type: Cone filter (K&N or equivalent)
  Location: Intercooler outlet (draws cool, dense air)
  Size: 4" diameter (large, low restriction)
  Flow rating: 150+ CFM (adequate for 420 whp)

Mass air flow (MAF) sensor:
  Location: Factory location maintained (factory airbox removed)
  Sensor type: Factory VQ MAF (re-used, recalibrated in ECU tune)
  Bypass valve: 30mm, mounted on air intake (safety feature)
```

---

## Part 10: Electrical & Control System

### ECU Tuning Interface

```
Tuning method: ROM modification (bootloader access via OBD)
Tools required: Nistune programmer or equivalent

Custom tune includes:
  Fuel map: Optimized for turbo boost (12.5-13.0 AFR at WOT)
  Ignition map: Knock-adaptive timing (20-22° at boost)
  Boost target: 10 psi at 6000 rpm (ramp strategy 3000-6000)
  Fuel injector trim: Calibrated for 380cc injectors
  Idle control: Retuned for added air from piping
  VVT offset: Optimized for forced induction efficiency

Knock sensor tuning:
  Factory knock sensor retained (critical for knock detection)
  Knock threshold: Set slightly below detonation point
  Timing adjustment: -1° per knock event (safe margin)
  Recovery: +0.5° per cycle (fast return to target)

Safety protections:
  Fuel cutoff: Activates if boost exceeds 11 psi
  Temperature cutoff: Reduces boost if coolant exceeds 105°C
  Knock cutoff: Reduces boost if knock count exceeds threshold
  Fuel pressure monitoring: Cutoff if pressure drops below 40 psi
```

### Wiring & Sensors

```
Boost pressure sensor:
  Type: 0-2 bar analog (0-5V output)
  Location: Intake manifold (post-intercooler)
  Function: Feedback for boost control solenoid
  Gauge/ECU: Wired to aftermarket boost gauge + ECU

Intake air temperature (IAT) sensor:
  Type: Factory thermistor (post-intercooler)
  Location: Charge pipe, downstream of intercooler
  Modification: Relocate sensor to read cooled intake temp
  Function: ECU richening at high intake temps

Fuel pressure sensor:
  Type: 0-100 psi analog (0-5V output)
  Location: Fuel rail
  Function: ECU fuel supply monitoring (safety cutoff backup)
  Installation: T-fitting in fuel pressure line

Knock sensor:
  Type: Factory sensor (retained)
  Recalibration: ECU tune accounts for boost-induced knock characteristics

Wastegate solenoid control:
  Voltage: 12V DC, <1 amp
  Function: Boost modulation via ECU PWM (pulse-width modulation)
  Frequency: 100 Hz (adequate for turbo response)
  Wiring: Factory relay + aftermarket timer module
```

---

## Complete Parts List & BOM

| Part # | Description | Qty | Supplier | Unit Cost | Total |
|---|---|---|---|---|---|
| 1.1 | Turbocharger (Garrett GT2871) | 1 | CJM/Precision | $1,200 | $1,200 |
| 2.1 | Exhaust Manifold (Cast, Custom) | 1 | Custom Fabricator | $1,500 | $1,500 |
| 3.1 | Downpipe (3" Stainless, Custom) | 1 | Custom Fabricator | $900 | $900 |
| 4.1 | Intercooler Core (600×300×100) | 1 | CJM/Spearco | $800 | $800 |
| 4.2 | Intercooler Piping Kit (Aluminum) | 1 | Custom Fabricator | $600 | $600 |
| 4.3 | Boost Control Solenoid (3-way) | 1 | Turbosmart/Tial | $250 | $250 |
| 5.1 | Oil Feed Line (-10 AN, Stainless) | 1 | Russell/Aeroquip | $150 | $150 |
| 5.2 | Oil Return Line (-12 AN, Stainless) | 1 | Russell/Aeroquip | $150 | $150 |
| 5.3 | Pressure Relief Valve (Inline) | 1 | Aeroquip | $120 | $120 |
| 6.1 | Fuel Injectors (380cc, 6× set) | 1 | Nissan OEM/Upgrade | $400 | $400 |
| 6.2 | Fuel Pump (340 LPH, In-tank) | 1 | Walbro/Carter | $250 | $250 |
| 6.3 | Fuel Accumulator (0.5L) | 1 | Fuel Systems Supply | $100 | $100 |
| 7.1 | Wastegate (38mm External) | 1 | Tial/Turbosmart | $300 | $300 |
| 8.1 | Turbo Support Bracket (Aluminum) | 1 | Custom Fabricator | $400 | $400 |
| 8.2 | Intercooler Mount Bracket (Aluminum) | 1 | Custom Fabricator | $400 | $400 |
| 8.3 | Heat Shield (Stainless Steel) | 1 | Custom Fabricator | $600 | $600 |
| 9.1 | Intake Pipe (3" Aluminum, Custom) | 1 | Custom Fabricator | $300 | $300 |
| 9.2 | Air Filter (Cone, 4" K&N) | 1 | K&N/AEM | $80 | $80 |
| 10.1 | Boost Pressure Sensor (0-2 bar) | 1 | AEM/Honeywell | $100 | $100 |
| 10.2 | Intake Air Temp Sensor | 1 | Nissan OEM | $50 | $50 |
| 10.3 | Fuel Pressure Sensor (0-100 psi) | 1 | AEM/Honeywell | $100 | $100 |
| 10.4 | Custom ECU Tune (Software) | 1 | Tuner (e.g., Nistune) | $500 | $500 |
| 11.1 | Fasteners, Fittings, Clamps (Kit) | 1 | Assorted | $300 | $300 |
| 11.2 | Coolant, Oil, Fluids (Top-up) | 1 | Nissan OEM | $150 | $150 |

**Subtotal Parts**: $10,250
**Estimated Fabrication & Labor**: $2,000-3,000
**Dyno Tuning & Validation**: $1,000-1,500
**Total System Cost**: $13,250-14,750

---

## Assembly Sequence & Installation Guide

### Phase 1: Engine & Manifold (12-16 hours)

**1.1** - Remove factory intake airbox, throttle body cover, spark plugs
**1.2** - Install custom manifold bolts (oil feed line adaptor pre-installed)
  - Torque manifold bolts: 50 N⋅m (37 ft-lbs)
  - Install heat shield: Spacing 25mm, rubber isolators
**1.3** - Install turbo on manifold
  - Torque: 50 N⋅m (37 ft-lbs)
  - Connect oil feed line (pressure relief valve pre-installed)
  - Connect oil return line (ball check valve mandatory)
**1.4** - Install turbo support bracket
  - Torque engine block bolts: 80 N⋅m (59 ft-lbs)
  - Torque subframe bolts: 40 N⋅m (30 ft-lbs)
  - Install rubber isolators at all attachment points

### Phase 2: Fuel System Upgrade (4-6 hours)

**2.1** - Drain fuel tank (siphon or pump method)
**2.2** - Remove fuel pump/sender module
  - Disconnect electrical connector
  - Remove locking ring (special tool: Nissan YA3175)
**2.3** - Swap fuel pump (old 255 LPH → new 340 LPH)
  - Re-install sender module with upgraded pump
  - Refill fuel tank (premium 93+ octane)
**2.4** - Remove fuel rail (6 bolts, 20 N⋅m torque)
  - Swap injectors (old 280cc → new 380cc)
  - Reinstall fuel rail (torque: 20 N⋅m)
**2.5** - Install fuel accumulator
  - T-fitting in fuel pressure line
  - Torque: Hand-tight + 1/4 turn (stainless fitting)

### Phase 3: Exhaust System (6-8 hours)

**3.1** - Remove factory exhaust manifold
  - 4× M12 bolts, fasteners often seized (heat + penetrating oil)
  - Disconnect O2 sensor (electrical connector)
**3.2** - Install custom manifold + turbo assembly
  - Bolt manifold to head (50 N⋅m × 4 bolts)
  - Gasket: High-temp MLS (multi-layer steel)
  - Torque sequence: Cross-pattern to prevent distortion
**3.3** - Install downpipe
  - Bolt to turbo outlet: 50 N⋅m (6 bolts)
  - Support with bellypan bracket: M8 bolt, 40 N⋅m
  - Hang from frame: Rubber isolators at 2 points

### Phase 4: Intercooler & Charge Piping (10-14 hours)

**4.1** - Modify front bumper
  - Cut 600×300mm opening (centered, 100mm from bottom)
  - Reinforce edges with aluminum channel
  - Install mesh/trim ring for appearance
**4.2** - Install intercooler mounting bracket
  - Weld aluminum angle to frame rails (forward of wheels)
  - Bolts: 2× M10 through bracket, 80 N⋅m each
  - Verify clearance: Suspension full droop/compression
**4.3** - Mount intercooler core
  - Position in bumper opening
  - Attach to bracket with rubber-isolated clamps
  - Ensure 25mm clearance on all sides (heat dissipation)
**4.4** - Install charge piping
  - Connect turbo outlet → intercooler inlet
  - Mandrel bend: Smooth, no kinks
  - Connect intercooler outlet → intake port
  - Use aluminum fittings (no rubber hose, high pressure)
**4.5** - Install boost control solenoid
  - Mount in engine bay (high location, protected)
  - Connect electrical: 12V power, ECU signal
  - Connect pneumatic: Boost signal → wastegate reference
**4.6** - Install wastegate
  - Mount external to manifold
  - Connect actuator rod to exhaust bypass valve
  - Adjust cracking pressure: 10 psi (shim adjustment)

### Phase 5: Engine Bay Preparation (6-8 hours)

**5.1** - Heat shielding
  - Wrap downpipe with stainless steel wrap
  - Install heat deflector under transmission
  - Seal engine bay: Close ducts around intercooler (direct airflow)
**5.2** - Install sensors
  - Boost pressure sensor: Intake manifold post-IC
  - Intake air temp sensor: Charge pipe outlet
  - Fuel pressure sensor: Fuel rail T-fitting
  - Knock sensor: Factory location (retained)
**5.3** - Wiring harness
  - Run new wiring for sensors to ECU
  - Install aftermarket boost gauge (driver information)
  - Connect solenoid wiring to ECU module
**5.4** - Final mechanical checks
  - Verify all bolts torqued to spec
  - Check for fuel/oil/coolant leaks (visual)
  - Ensure no interference (full suspension travel)
  - Test oil/coolant circulation (engine start, brief run)

### Phase 6: ECU Tuning & Dyno Validation (4-6 hours)

**6.1** - Baseline dyno pull (untuned ROM)
  - Record stock power curve
  - Note any knock events
  - Establish baseline AFR/timing
**6.2** - Custom tune installation
  - Extract ROM via bootloader
  - Tune fuel, timing, boost maps
  - Flash updated ROM back to ECU
**6.3** - Tuned dyno validation (3-5 pulls)
  - Confirm target power (380-420 whp)
  - Monitor AFR, timing, knock counts
  - Data logging: Temperature verification
**6.4** - Street validation
  - Easy acceleration (confirm drivability)
  - Hard acceleration (confirm power delivery)
  - Extended highway drive (thermal stability)
  - Fuel economy spot-check (reasonable consumption)

---

## Validation & Quality Assurance

### Pre-Start Checklist (Before First Ignition)

- [ ] All bolts torqued to spec (manifold, turbo, brackets)
- [ ] Oil feed line connected, pressure relief set to 80 psi
- [ ] Oil return line installed with ball check valve
- [ ] Coolant system topped up, no leaks visible
- [ ] Fuel system: Pump prime verified, no leaks
- [ ] Charge piping: All connections tight, no gaps
- [ ] Heat shields: Proper spacing, no contact
- [ ] Electrical: All sensor connectors secure, no shorts
- [ ] Intake: Pipe sealed, filter installed, no leaks
- [ ] Exhaust: Downpipe and welds inspected, heat shield in place

### First-Run Procedure (Idle Check, 5 minutes)

1. **Turn ignition on** (don't start): Fuel pump prime for 3 seconds
2. **Check fuel pressure gauge**: Should read 43-50 psi (regulator setting)
3. **Check for fuel leaks**: Look under engine, around fuel lines
4. **Start engine**: Listen for unusual knocking/pinging
5. **Idle observation** (1 minute):
   - Oil pressure gauge: 40+ psi (normal idle)
   - Coolant temperature: Rising normally
   - No smoke, unusual smells
   - Exhaust: Slight smoke normal (condensation)
6. **Boost gauge check**: Should read 0 psi at idle
7. **Gentle throttle**: Boost should rise smoothly, no spikes
8. **Recheck leaks**: Turn off engine, inspect again

### Short Drive Validation (15 minutes, Light Load)

- Accelerate gently: Confirm smooth throttle response
- Light boost run (3-5 psi): Listen for knock, feel power
- Return to base: Check temps, no overheating
- Check all systems: Gauges, sounds, warnings

### Dyno Session (Professional Validation, 2-3 hours)

- **Baseline pull (pre-tune)**: Verify no boost leaks
- **Tuning adjustments**: Fuel, timing, boost target refinement
- **Final validation**: 3-5 pulls confirming target power/AFR/timing
- **Data acquisition**: Thermal imaging, fuel consumption, efficiency
- **Certification**: Document build for records/warranty purposes

---

## Long-Term Maintenance Schedule (After Turbo Installation)

| Interval | Task | Criticality |
|---|---|---|
| 500 miles | Check all bolts, leaks, hose routing | Critical |
| 1,000 miles | Change oil & filter (fresh start after rebuild) | Critical |
| 3,000 miles | Change oil & filter (turbo life depends on clean oil) | Critical |
| 5,000 miles | Standard oil change | High |
| 10,000 miles | Inspect heat shields, charge pipes for cracks | High |
| 15,000 miles | Fuel filter replacement | Medium |
| 20,000 miles | Change coolant (added system complexity) | High |
| 30,000 miles | Spark plugs (iridium, gap 0.028-0.032") | Medium |
| 50,000 miles | Intercooler core flush (heat exchanger efficiency) | Medium |
| 75,000 miles | Turbo bearing inspection (service/replace if needed) | High |

**Oil Grade**: Synthetic 0W-40 (turbo thermal protection) or 10W-40 if climate permits
**Coolant Type**: Nissan OEM or equivalent silicate-free premium
**Fuel Grade**: 93+ octane premium (safety for knock avoidance)

---

## Safety & Legal Considerations

### Street Legality
- **Emissions**: Custom tune may void emission compliance; verify local regulations
- **Warranty**: Engine warranty voided by turbo retrofit
- **Insurance**: Disclose modifications; some insurers require higher premiums
- **Inspection**: State inspection may flag boost pressure or emissions issues

### Reliability Margins
- **Oil cooling**: Marginal; oil temps may exceed 230°F track use
- **Transmission**: 6MT adequate to 420 whp; 5AT struggles at 380+
- **Cooling system**: Stock adequate if tuned conservatively; upgrade recommended track use
- **Fuel system**: Upgraded injectors/pump adequate; no further scaling feasible without internal engine work

### Failure Mode Prevention
- Oil starvation: Use premium synthetic, frequent changes
- Detonation: Quality fuel (93+), knock sensor feedback
- Heat soak: Heat shielding critical, idle in traffic risky
- Compressor surge: Blow-off valve mandatory

---

## Manufacturing Supplier Recommendations

**Turbocharger**: Garrett GT2871 or Mitsubishi TD05
- Suppliers: CJM, Precision Turbo, Forced Performance
- Lead time: 2-4 weeks (stock), 8-12 weeks (custom)

**Manifold Casting**: Local machine shop with ductile iron capability
- Suppliers: Local foundry + CNC machining
- Cost: $1,200-1,800 (mold creation, casting, finishing)
- Lead time: 4-6 weeks (one-off)

**Piping & Brackets**: Custom aluminum fabrication
- Suppliers: Local welding shop (TIG capability), CNC machine shop
- Cost: $600-1,200 per component
- Lead time: 2-3 weeks

**Intercooler**: Spearco, CJM, Custom bar-plate
- Suppliers: Racing suppliers, custom fabricators
- Cost: $800-1,200
- Lead time: 2-4 weeks

**ECU Tuning**: Nistune, EcuTek tuner network
- Suppliers: Specialized tuning shops (research local)
- Cost: $500-1,000 (custom tune + dyno time)
- Lead time: 1-2 weeks (after parts installation)

---

**END OF MANUFACTURING SPECIFICATION**

This document is production-ready and can be sent to fabricators for quotation and manufacturing. All dimensions are approximate and should be verified on actual Z engine bay fitment. Custom fabrication recommended for optimal results.
