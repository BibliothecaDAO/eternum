# Resource distribution
resource_distribution = {
    "Wood": 5015, "Stone": 3941, "Coal": 3833, "Copper": 2643, "Obsidian": 2216,
    "Silver": 1741, "Ironwood": 1179, "Cold Iron": 957, "Gold": 914, "Hartwood": 594,
    "Diamonds": 300, "Sapphire": 247, "Ruby": 239, "DeepC": 239, "Ignium": 172,
    "EtherealS": 162, "True Ice": 139, "Twilight Q": 111, "AlchemicalS": 93,
    "Adamantine": 55, "Mithral": 37, "Dragonhide": 23
}

# Calculate resource values based on scarcity
resource_values = {k: 1/v for k, v in resource_distribution.items()}

# Predefined resource inputs
resource_inputs = {
    "Wood": ("Coal", "Stone"),
    "Stone": ("Wood", "Coal"),
    "Coal": ("Stone", "Copper"),
    "Copper": ("Coal", "Obsidian"),
    "Obsidian": ("Copper", "Silver"),
    "Silver": ("Obsidian", "Ironwood"),
    "Ironwood": ("Silver", "Cold Iron"),
    "Cold Iron": ("Ironwood", "Gold"),
    "Gold": ("Cold Iron", "Hartwood"),
    "Hartwood": ("Gold", "Diamonds"),
    "Diamonds": ("Hartwood", "Sapphire"),
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
    "Dragonhide": ("Mithral", "Wood")
}

# Determine input requirements based on predefined pairs
input_requirements = {}
for resource, (input1, input2) in resource_inputs.items():
    value = resource_values[resource]
    ratio1 = round(value / resource_values[input1], 2)
    ratio2 = round(value / resource_values[input2], 2)
    input_requirements[resource] = {input1: ratio1, input2: ratio2}

# Print input requirements for each resource
base_production_unit = 100
scaling_factor = 20  # Adjust this factor based on your game balance needs

# Calculate and print whole-number input requirements
for resource, inputs in input_requirements.items():
    print(f"{resource}:")
    for input_resource, ratio in inputs.items():
        # Calculate the whole number of input units required
        input_units = round(ratio * scaling_factor)
        print(f"  {input_units} units of {input_resource}")
    print()