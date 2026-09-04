import numpy as np

# Resource distribution (Fixed)
resource_distribution = {
    "Wood": 5015, "Stone": 3941, "Coal": 3833, "Copper": 2643, "Obsidian": 2216,
    "Silver": 1741, "Ironwood": 1179, "Cold Iron": 957, "Gold": 914, "Hartwood": 594,
    "Diamonds": 300, "Sapphire": 247, "Ruby": 239, "DeepC": 239, "Ignium": 172,
    "EtherealS": 162, "True Ice": 139, "Twilight Q": 111, "AlchemicalS": 93,
    "Adamantine": 55, "Mithral": 37, "Dragonhide": 23
}

# Add Wheat to the resource distribution
resource_distribution['Wheat'] = 0  # Produced for free

# Calculate resource values based on scarcity (exclude Wheat)
resource_values = {k: 1 / v for k, v in resource_distribution.items() if v > 0}
resource_values['Wheat'] = 0  # Assign zero value to Wheat

# Predefined resource inputs (Fixed)
RESOURCE_PRODUCTION_INPUT_RESOURCES = {
    "Wood": ("Coal", "Stone"),
    "Stone": ("Wood", "Coal"),
    "Coal": ("Wood", "Copper"),
    "Copper": ("Coal", "Obsidian"),
    "Obsidian": ("Copper", "Silver"),
    "Silver": ("Obsidian", "Ironwood"),
    "Ironwood": ("Silver", "Cold Iron"),
    "Cold Iron": ("Ironwood", "Gold"),
    "Gold": ("Cold Iron", "Silver"),
    "Hartwood": ("Gold", "Diamonds"),
    "Diamonds": ("Hartwood", "Ironwood"),
    "Sapphire": ("Diamonds", "Ruby"),
    "Ruby": ("Sapphire", "DeepC"),
    "DeepC": ("Ruby", "Ignium"),
    "Ignium": ("DeepC", "EtherealS"),
    "EtherealS": ("Ignium", "True Ice"),
    "True Ice": ("EtherealS", "Twilight Q"),
    "Twilight Q": ("True Ice", "AlchemicalS"),
    "AlchemicalS": ("Twilight Q", "Adamantine"),
    "Adamantine": ("AlchemicalS", "Mithral"),
    "Mithral": ("Adamantine", "Dragonhide"),
    "Dragonhide": ("Mithral", "Adamantine")
}

desired_total_input_fraction = 0.4
scaling_factor = 1000

# Determine input requirements
input_requirements = {}
for resource, (input1, input2) in RESOURCE_PRODUCTION_INPUT_RESOURCES.items():
    value_output = resource_values[resource]
    value_input1 = resource_values[input1]
    value_input2 = resource_values[input2]

    desired_total_input_cost = desired_total_input_fraction * value_output

    # Split the input cost equally between the two inputs
    cost_input1 = desired_total_input_cost / 2
    cost_input2 = desired_total_input_cost / 2

    # Calculate the number of input units required for each input
    input_units1 = cost_input1 / value_input1 if value_input1 > 0 else 0
    input_units2 = cost_input2 / value_input2 if value_input2 > 0 else 0

    # Apply scaling factor and round to nearest integer
    scaled_units1 = round(input_units1 * scaling_factor)
    scaled_units2 = round(input_units2 * scaling_factor)

    input_requirements[resource] = {
        input1: scaled_units1,
        input2: scaled_units2
    }

# Buildings
buildings = {
    'Resource': {
    },
    'Farm': {
        'Wood': 100000,
    },
    'FishingVillage': {
        'Wood': 100000,
    },
    'Barracks': {
        'Stone': 100000,
        'Obsidian': 59900,
        'Silver': 49900
    },
    'Market': {
        'Wood': 100000,
        'Gold': 20000,
        'Silver': 20000
    },
    'ArcheryRange': {
        'Wood': 100000,
        'Ironwood': 50000,
        'Copper': 50000
    },
    'Stable': {
        'Wood': 100000,
        'Ironwood': 70000,
        'Hartwood': 40000
    },
    'WorkersHut': {
        'Wood': 100000,
        'Coal': 30000,
        'Copper': 30000
    },
    'Storehouse': {
        'Wood': 100000,
        'Stone': 50000,
        'Coal': 50000
    },
}

# Adjusted average number of buildings constructed per game
average_buildings_constructed = {
    'Resource': 5,
    'Farm': 4,
    'FishingVillage': 3,
    'Barracks': 3,
    'Market': 3,
    'ArcheryRange': 3,
    'Stable': 3,
    'WorkersHut': 3,
    'Storehouse': 3,
}

# Troops and their resource costs
troops = {
    'Infantry': {
        'Ironwood': 60,
        'Obsidian': 60,
        'Copper': 60
    },
    'Archer': {
        'Copper': 60,
        'Obsidian': 60,
        'Sapphire': 60
    },
    'Cavalry': {
        'Ironwood': 60,
        'Gold': 60,
        'Hartwood': 60
    }
}
# Adjusted average number of troops trained per game
average_troops_trained = {
    'Infantry': 10000,
    'Archer': 10000,
    'Cavalry': 10000
}

# Parameters for travel costs
wheat_per_troop = 12  # Adjust as needed
total_troops = sum(average_troops_trained.values())
travel_wheat_consumption = total_troops * wheat_per_troop

# Donkey resource costs
donkey_costs = {
    'Sapphire': 50,
    'Ironwood': 30,
    'Gold': 50
}

# Average number of donkeys used per game
average_donkeys = 3000  # Adjust as needed

# Hyperstructure resource costs (consumes every resource except Wheat)
hyperstructure_costs = {resource: 1000000 for resource in resource_distribution.keys() if resource != 'Wheat'}

# Average number of hyperstructures constructed per game
average_hyperstructures = 1  # Adjust as needed

resources = list(resource_distribution.keys())
resource_indices = {resource: idx for idx, resource in enumerate(resources)}
n = len(resources)

# Initialize consumption matrix C and demand vector D
C = np.zeros((n, n))
D = np.zeros(n)

# Fill the consumption matrix C
for resource, inputs in input_requirements.items():
    resource_idx = resource_indices[resource]
    print(f"Resource: {resource}")
    for input_resource, input_units in inputs.items():

        print(f"  {input_resource}: {input_units}")
        input_idx = resource_indices[input_resource]
        actual_input_units = input_units / scaling_factor
        C[input_idx, resource_idx] = actual_input_units

# Fill the demand vector D from buildings and troops
for building, quantity in average_buildings_constructed.items():
    costs = buildings[building]
    for resource, amount in costs.items():
        idx = resource_indices[resource]
        D[idx] += amount * quantity

for troop, quantity in average_troops_trained.items():
    costs = troops[troop]
    for resource, amount in costs.items():
        idx = resource_indices[resource]
        D[idx] += amount * quantity

# Include travel costs (Wheat consumption)
idx_wheat = resource_indices['Wheat']
D[idx_wheat] += travel_wheat_consumption

# Include Donkey costs
for resource, amount in donkey_costs.items():
    idx = resource_indices[resource]
    D[idx] += amount * average_donkeys

# Include Hyperstructure costs
for resource, amount in hyperstructure_costs.items():
    idx = resource_indices[resource]
    D[idx] += amount * average_hyperstructures

# Desired net production N proportional to initial percentages (excluding Wheat)
total_initial_resources = sum(resource_distribution[res] for res in resources if res != 'Wheat')
initial_quantities = np.array([resource_distribution[resource] for resource in resources])
initial_percentages = np.array([resource_distribution[resource] / total_initial_resources if resource != 'Wheat' else 0 for resource in resources])
desired_total_net_production = D.sum()  # Total demand
N = desired_total_net_production * initial_percentages

# Adjust N and D to exclude Wheat from the linear system
mask = np.ones(n, dtype=bool)
mask[idx_wheat] = False  # Exclude Wheat

A_mod = (np.identity(n) - C)[mask][:, mask]
B_mod = (N + D)[mask]

# Solve the modified linear system
try:
    P_mod = np.linalg.solve(A_mod, B_mod)
except np.linalg.LinAlgError:
    P_mod, residuals, rank, s = np.linalg.lstsq(A_mod, B_mod, rcond=None)

P_mod = np.maximum(P_mod, 0)  # Ensure non-negative production quantities

# Initialize P and set Wheat production
P = np.zeros(n)
P[mask] = P_mod
P[idx_wheat] = D[idx_wheat]  # Produce exactly what is needed for Wheat

# Calculate total production
total_calculated_production = P.sum()
calculated_percentages = P / total_calculated_production

# Calculate differences in percentages
percentage_difference = calculated_percentages * 100 - initial_percentages * 100

# Print the results
print("Resource\tInitial Qty\tCalculated Qty\tDifference Qty\tInitial %\tCalculated %\tDifference %")
for idx, resource in enumerate(resources):
    initial_qty = initial_quantities[idx]
    calculated_qty = P[idx]
    qty_difference = calculated_qty - initial_qty
    initial_pct = initial_percentages[idx] * 100
    calculated_pct = calculated_percentages[idx] * 100
    pct_difference = calculated_pct - initial_pct
    print(f"{resource:<15}{initial_qty:>12.2f}\t{calculated_qty:>14.2f}\t{qty_difference:>14.2f}\t{initial_pct:>8.2f}%\t{calculated_pct:>12.2f}%\t{pct_difference:>11.2f}%")
