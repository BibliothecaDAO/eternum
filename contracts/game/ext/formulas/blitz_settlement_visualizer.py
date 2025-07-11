#!/usr/bin/env python3
"""
Blitz Settlement Coordinate Generation Visualizer

This script implements the BlitzSettlementConfig algorithm from the Cairo contract
and provides visualization to understand how coordinates are generated.
"""

import math
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.widgets import Slider
from enum import Enum
from dataclasses import dataclass
from typing import List, Tuple, Optional
import numpy as np

# Map center (same as in the Cairo contract)
CENTER = 2147483646

class Direction(Enum):
    EAST = 0
    NORTH_EAST = 1
    NORTH_WEST = 2
    WEST = 3
    SOUTH_WEST = 4
    SOUTH_EAST = 5

@dataclass
class Coord:
    x: int
    y: int
    
    def __str__(self):
        return f"({self.x}, {self.y})"
    
    def __repr__(self):
        return self.__str__()

@dataclass 
class Cube:
    q: int
    r: int
    s: int
    
    def __add__(self, other):
        return Cube(self.q + other.q, self.r + other.r, self.s + other.s)

class HexGrid:
    """Hexagonal grid coordinate system implementation"""
    
    @staticmethod
    def coord_to_cube(coord: Coord) -> Cube:
        """Convert even-r offset coordinates to cube coordinates"""
        col = coord.x
        row = coord.y
        q = col - (row + (row & 1)) // 2
        r = row
        s = -q - r
        return Cube(q, r, s)
    
    @staticmethod
    def cube_to_coord(cube: Cube) -> Coord:
        """Convert cube coordinates to even-r offset coordinates"""
        col = cube.q + (cube.r + (cube.r & 1)) // 2
        row = cube.r
        return Coord(col, row)
    
    @staticmethod
    def neighbor_after_distance(coord: Coord, direction: Direction, distance: int) -> Coord:
        """Move distance tiles in the specified direction"""
        cube = HexGrid.coord_to_cube(coord)
        
        # Direction vectors in cube coordinates
        direction_vectors = {
            Direction.EAST: Cube(distance, 0, -distance),
            Direction.NORTH_EAST: Cube(0, distance, -distance),
            Direction.NORTH_WEST: Cube(-distance, distance, 0),
            Direction.WEST: Cube(-distance, 0, distance),
            Direction.SOUTH_WEST: Cube(0, -distance, distance),
            Direction.SOUTH_EAST: Cube(distance, -distance, 0),
        }
        
        neighbor_cube = cube + direction_vectors[direction]
        return HexGrid.cube_to_coord(neighbor_cube)

class BlitzSettlementConfig:
    """Implementation of the BlitzSettlementConfig algorithm"""
    
    def __init__(self, base_distance: int):
        self.base_distance = base_distance
        self.side = 0
        self.step = 1
        self.point = 1
        
        # Validate base_distance is even
        if base_distance % 2 != 0:
            raise ValueError("base_distance must be even")
    
    def max_points(self) -> int:
        """Calculate maximum points for current step"""
        return self.step * 2
    
    @staticmethod
    def step_tile_distance() -> int:
        return 18
    
    @staticmethod
    def realm_tile_radius() -> int:
        return 6
    
    @staticmethod
    def mirror_first_step_tile_distance() -> int:
        return 14
    
    @staticmethod
    def mirror_second_step_tile_distance() -> int:
        return 4
    
    def next(self):
        """Advance to next settlement position (iterator pattern)"""
        if self.side == 5:
            if self.point == self.max_points():
                self.step += 1
                self.point = 1
            else:
                self.point += 1
            self.side = 0
        else:
            self.side += 1
    
    def generate_coords(self) -> List[Coord]:
        """Generate the 3 coordinates for current settlement"""
        start_coord = Coord(CENTER, CENTER)
        
        # Direction pairs for each side
        start_directions = [
            (Direction.EAST, Direction.NORTH_WEST),
            (Direction.SOUTH_EAST, Direction.NORTH_EAST),
            (Direction.SOUTH_WEST, Direction.EAST),
            (Direction.WEST, Direction.SOUTH_EAST),
            (Direction.NORTH_WEST, Direction.SOUTH_WEST),
            (Direction.NORTH_EAST, Direction.WEST),
        ]
        
        start_direction, triangle_direction = start_directions[self.side]
        
        # Calculate base position for this side
        side_first_structure_step_one = HexGrid.neighbor_after_distance(
            start_coord, start_direction, self.base_distance
        )
        side_first_structure_step_one = HexGrid.neighbor_after_distance(
            side_first_structure_step_one, triangle_direction, self.base_distance // 2
        )
        
        # Calculate position for current step
        side_first_structure_step_x = HexGrid.neighbor_after_distance(
            side_first_structure_step_one, 
            start_direction, 
            self.step_tile_distance() * (self.step - 1)
        )
        
        # Check if this point should be mirrored
        is_mirrored = self.point > self.max_points() // 2
        
        if not is_mirrored:
            # Non-mirrored triangle
            destination_start_coord = HexGrid.neighbor_after_distance(
                side_first_structure_step_x,
                triangle_direction,
                self.step_tile_distance() * (self.point - 1)
            )
            
            a = destination_start_coord
            b = HexGrid.neighbor_after_distance(a, start_direction, self.realm_tile_radius())
            c = HexGrid.neighbor_after_distance(b, triangle_direction, self.realm_tile_radius())
            
            return [a, b, c]
        else:
            # Mirrored triangle
            start_point = self.max_points() - self.point + 1
            destination_start_coord = HexGrid.neighbor_after_distance(
                side_first_structure_step_x,
                triangle_direction,
                self.step_tile_distance() * (start_point - 1)
            )
            
            a = HexGrid.neighbor_after_distance(
                destination_start_coord, start_direction, self.mirror_first_step_tile_distance()
            )
            a = HexGrid.neighbor_after_distance(
                a, triangle_direction, self.mirror_second_step_tile_distance()
            )
            
            b = HexGrid.neighbor_after_distance(a, triangle_direction, self.realm_tile_radius())
            c = HexGrid.neighbor_after_distance(b, start_direction, self.realm_tile_radius())
            
            return [a, b, c]

def visualize_settlements(base_distance: int, max_settlements: int = 24):
    """Generate and visualize settlement coordinates"""
    config = BlitzSettlementConfig(base_distance)
    settlements = []
    
    print(f"Generating settlements with base_distance = {base_distance}")
    print("=" * 80)
    
    for i in range(max_settlements):
        coords = config.generate_coords()
        settlements.append({
            'id': i + 1,
            'side': config.side,
            'step': config.step,
            'point': config.point,
            'coords': coords,
            'is_mirrored': config.point > config.max_points() // 2
        })
        
        print(f"Settlement {i+1:2d}: Side {config.side}, Step {config.step}, Point {config.point}")
        print(f"  Mirrored: {config.point > config.max_points() // 2}")
        print(f"  Coordinates: {coords}")
        print()
        
        config.next()
    
    return settlements



def plot_settlements_interactive(max_settlements: int = 72, base_distance: int = 8):
    """Create an interactive plot with slider to control number of settlements"""
    # Generate all settlements up to max_settlements
    config = BlitzSettlementConfig(base_distance)
    all_settlements = []
    
    for i in range(max_settlements):
        coords = config.generate_coords()
        all_settlements.append({
            'id': i + 1,
            'side': config.side,
            'step': config.step,
            'point': config.point,
            'coords': coords,
            'is_mirrored': config.point > config.max_points() // 2
        })
        config.next()
    
    center_x, center_y = CENTER, CENTER
    
    # Calculate the maximum extent of all settlements for fixed axis limits
    all_x_coords = []
    all_y_coords = []
    
    for settlement in all_settlements:
        for coord in settlement['coords']:
            all_x_coords.append(coord.x - center_x)
            all_y_coords.append(coord.y - center_y)

    # Create the figure and axis
    fig, ax = plt.subplots(figsize=(14, 10))
    plt.subplots_adjust(bottom=0.3, right=0.75) # Adjust for legend and sliders
    
    # Create settlement slider
    ax_settlement_slider = plt.axes([0.2, 0.15, 0.6, 0.03])
    settlement_slider = Slider(
        ax_settlement_slider, 'Number of Settlements', 1, max_settlements, 
        valinit=24, valfmt='%d'
    )
    
    # Create padding/zoom slider
    ax_padding_slider = plt.axes([0.2, 0.1, 0.6, 0.03])
    MIN_PADDING = 10
    MAX_PADDING = 500
    ULTRA_ZOOM_PADDING = -200 # For zooming in beyond 100%
    
    # Invert slider so left is zoomed-out, right is zoomed-in
    padding_slider = Slider(
        ax_padding_slider, 'Zoom Level', 0, 200, 
        valinit=80, valfmt='%d%%'
    )
    
    # Colors for different steps
    step_colors = plt.get_cmap('viridis')

    def get_step_corners(config_instance: BlitzSettlementConfig, step: int):
        """Calculate the 6 corners of the hexagon for a given step."""
        corners = []
        # Directions from the contract
        start_directions = [
            (Direction.EAST, Direction.NORTH_WEST),
            (Direction.SOUTH_EAST, Direction.NORTH_EAST),
            (Direction.SOUTH_WEST, Direction.EAST),
            (Direction.WEST, Direction.SOUTH_EAST),
            (Direction.NORTH_WEST, Direction.SOUTH_WEST),
            (Direction.NORTH_EAST, Direction.WEST),
        ]
        start_coord = Coord(CENTER, CENTER)
        
        for side in range(6):
            start_direction, triangle_direction = start_directions[side]
            
            side_first_structure_step_one = HexGrid.neighbor_after_distance(
                start_coord, start_direction, config_instance.base_distance
            )
            side_first_structure_step_one = HexGrid.neighbor_after_distance(
                side_first_structure_step_one, triangle_direction, config_instance.base_distance // 2
            )
            
            corner = HexGrid.neighbor_after_distance(
                side_first_structure_step_one, 
                start_direction, 
                config_instance.step_tile_distance() * (step - 1)
            )
            corners.append(corner)
        return corners

    def update_plot(val):
        """Update the plot based on slider values"""
        ax.clear()
        
        num_settlements = int(settlement_slider.val)
        
        # Invert the zoom slider value to calculate padding
        zoom_level = padding_slider.val
        
        if zoom_level <= 100:
            # From 0% to 100%, interpolate from MAX_PADDING down to MIN_PADDING
            padding = MAX_PADDING - (zoom_level / 100) * (MAX_PADDING - MIN_PADDING)
        else:
            # From 101% to 200%, interpolate from MIN_PADDING down to ULTRA_ZOOM_PADDING
            percentage_into_ultra = (zoom_level - 100) / 100
            padding = MIN_PADDING - percentage_into_ultra * (MIN_PADDING - ULTRA_ZOOM_PADDING)

        settlements_to_show = all_settlements[:int(num_settlements)]
        max_step = 0
        if settlements_to_show:
            max_step = max(s['step'] for s in settlements_to_show)

        # Find mirrored pairs to connect them visually
        settlement_map = {
            (s['side'], s['step'], s['point']): s 
            for s in settlements_to_show
        }
        mirrored_pairs_to_connect = []
        for settlement in settlements_to_show:
            if settlement['is_mirrored']:
                side = settlement['side']
                step = settlement['step']
                point = settlement['point']
                
                # This logic comes from the contract/config
                max_points_for_step = step * 2
                counterpart_point = max_points_for_step - point + 1
                
                counterpart_key = (side, step, counterpart_point)
                if counterpart_key in settlement_map:
                    counterpart_settlement = settlement_map[counterpart_key]
                    
                    # Calculate the centroid of each settlement triangle to connect centers
                    s_coords = settlement['coords']
                    c_coords = counterpart_settlement['coords']
                    
                    center1 = Coord(
                        x=sum(c.x for c in s_coords) // 3,
                        y=sum(c.y for c in s_coords) // 3
                    )
                    center2 = Coord(
                        x=sum(c.x for c in c_coords) // 3,
                        y=sum(c.y for c in c_coords) // 3
                    )
                    
                    mirrored_pairs_to_connect.append((center1, center2))

        # Draw connecting lines for mirrored pairs
        for center1, center2 in mirrored_pairs_to_connect:
            ax.plot(
                [center1.x - center_x, center2.x - center_x], 
                [center1.y - center_y, center2.y - center_y],
                color='magenta',
                linestyle='-.',
                linewidth=1.2,
                alpha=0.7
            )

        # Draw step hexagons
        temp_config = BlitzSettlementConfig(base_distance)
        for step in range(1, max_step + 1):
            corners = get_step_corners(temp_config, step)
            corners_x = [c.x - center_x for c in corners]
            corners_y = [c.y - center_y for c in corners]
            
            # Connect corners to form a hexagon
            for i in range(6):
                ax.plot(
                    [corners_x[i], corners_x[(i + 1) % 6]], 
                    [corners_y[i], corners_y[(i + 1) % 6]],
                    color=step_colors(step / (max_step + 1)),
                    linestyle='--',
                    linewidth=1.5,
                    alpha=0.8
                )

        for settlement in settlements_to_show:
            step = settlement['step']
            coords = settlement['coords']
            is_mirrored = settlement['is_mirrored']
            
            # Base color from step
            base_color = step_colors(step / (max_step + 1))
            
            # Modify color based on mirroring
            if is_mirrored:
                # For mirrored settlements, use a darker/redder variant
                color = (min(1.0, base_color[0] + 0.3), base_color[1] * 0.7, base_color[2] * 0.7)
                edge_style = ':'  # dotted line for mirrored
                alpha = 0.9
            else:
                # For non-mirrored settlements, use the base color
                color = base_color
                edge_style = '-'  # solid line for non-mirrored
                alpha = 0.7
            
            # Plot triangle
            triangle_x = [coord.x - center_x for coord in coords] + [coords[0].x - center_x]
            triangle_y = [coord.y - center_y for coord in coords] + [coords[0].y - center_y]
            
            ax.plot(triangle_x, triangle_y, color=color, linewidth=2, alpha=alpha, linestyle=edge_style)
            ax.fill(triangle_x, triangle_y, color=color, alpha=0.3)
            
            # Plot points with different markers for mirrored vs non-mirrored
            marker = 's' if is_mirrored else 'o'  # square for mirrored, circle for non-mirrored
            for j, coord in enumerate(coords):
                ax.plot(coord.x - center_x, coord.y - center_y, marker, 
                       color=color, markersize=4)
                
            # Label the settlement with mirroring indicator
            center_coord = coords[0]  # Use first coordinate as reference
            label = f"S{settlement['id']}{'M' if is_mirrored else ''}"
            ax.annotate(label, 
                       (center_coord.x - center_x, center_coord.y - center_y),
                       xytext=(5, 5), textcoords='offset points', fontsize=8)
        
        # Plot center
        ax.plot(0, 0, 'ko', markersize=8, label='Center')
        
        # Configure plot with wider initial limits
        x_min, x_max = min(all_x_coords) - padding, max(all_x_coords) + padding
        y_min, y_max = min(all_y_coords) - padding, max(all_y_coords) + padding
        ax.set_xlim(x_min, x_max)
        ax.set_ylim(y_min, y_max)
        ax.set_aspect('equal')
        ax.grid(True, alpha=0.3)
        ax.set_xlabel('X Offset from Center')
        ax.set_ylabel('Y Offset from Center')
        ax.set_title(f'Blitz Settlement Pattern - {int(num_settlements)} Settlements (Base Distance: {base_distance})')
        
        # Create legend
        legend_elements = [plt.Line2D([0], [0], color=step_colors(s / (max_step + 1)), lw=2, label=f'Step {s}') 
                           for s in range(1, max_step + 1)]
        legend_elements.append(plt.Line2D([0], [0], marker='o', color='black', 
                                         markersize=8, label='Center', linestyle='None'))
        
        # Add mirroring legend elements
        legend_elements.append(plt.Line2D([0], [0], color='gray', lw=2, linestyle='-', label='Non-mirrored'))
        legend_elements.append(plt.Line2D([0], [0], color='gray', lw=2, linestyle=':', label='Mirrored'))
        legend_elements.append(plt.Line2D([0], [0], marker='o', color='gray', 
                                         markersize=6, label='Non-mirrored points', linestyle='None'))
        legend_elements.append(plt.Line2D([0], [0], marker='s', color='gray', 
                                         markersize=6, label='Mirrored points', linestyle='None'))
        
        # Add mirrored pair connection legend
        legend_elements.append(plt.Line2D([0], [0], color='magenta', linestyle='-.', lw=1.2, label='Mirrored Pair Link'))

        ax.legend(handles=legend_elements, loc='center left', bbox_to_anchor=(1.05, 0.5))
        
        plt.draw()
    
    # Connect slider to update function
    settlement_slider.on_changed(update_plot)
    padding_slider.on_changed(update_plot)
    
    # Initial plot
    update_plot(None)
    
    return fig, settlement_slider, padding_slider

def demonstrate_algorithm():
    """Demonstrate the algorithm with detailed examples"""
    print("BLITZ SETTLEMENT COORDINATE GENERATION DEMONSTRATION")
    print("=" * 60)
    
    # Example 1: Basic demonstration
    print("\n1. Basic Algorithm Demonstration (base_distance = 8)")
    print("-" * 50)
    settlements = visualize_settlements(base_distance=8, max_settlements=48)
    
    # Example 2: Verify specific calculations
    print("\n2. Manual Calculation Verification")
    print("-" * 50)
    
    config = BlitzSettlementConfig(8)
    coords = config.generate_coords()
    
    print(f"Side 0, Step 1, Point 1:")
    print(f"Expected pattern: Non-mirrored triangle")
    print(f"Generated coordinates: {coords}")
    
    # Verify triangle properties
    if len(coords) == 3:
        a, b, c = coords
        print(f"Triangle edges:")
        print(f"  A to B: distance should be {config.realm_tile_radius()}")
        print(f"  B to C: distance should be {config.realm_tile_radius()}")
        print(f"  A to C: distance should be {config.realm_tile_radius()}")
    
    # Move to mirrored example
    config.point = 2
    coords_mirrored = config.generate_coords()
    print(f"\nSide 0, Step 1, Point 2 (Mirrored):")
    print(f"Generated coordinates: {coords_mirrored}")
    
    return settlements

def create_summary_table(settlements: List[dict]):
    """Create a summary table of settlement data"""
    print("\nSETTLEMENT SUMMARY TABLE")
    print("=" * 100)
    print(f"{'ID':<3} {'Side':<4} {'Step':<4} {'Point':<5} {'Mirror':<6} {'Coord A':<20} {'Coord B':<20} {'Coord C':<20}")
    print("-" * 100)
    
    for settlement in settlements:
        a, b, c = settlement['coords']
        print(f"{settlement['id']:<3} "
              f"{settlement['side']:<4} "
              f"{settlement['step']:<4} "
              f"{settlement['point']:<5} "
              f"{str(settlement['is_mirrored']):<6} "
              f"{str(a):<20} "
              f"{str(b):<20} "
              f"{str(c):<20}")

if __name__ == "__main__":
    # Run the demonstration
    settlements = demonstrate_algorithm()
    
    # Create summary table
    create_summary_table(settlements)
    
    # Create interactive visualization
    try:
        print("\nCreating interactive visualization...")
        fig, settlement_slider, padding_slider = plot_settlements_interactive(max_settlements=72, base_distance=8)
        plt.show()
        print("\nInteractive visualization created successfully!")
        print("Use the slider at the bottom to control the number of settlements displayed.")
    except ImportError:
        print("\nMatplotlib not available for visualization.")
        print("Install with: pip install matplotlib")
    
    print("\nAnalysis complete!") 