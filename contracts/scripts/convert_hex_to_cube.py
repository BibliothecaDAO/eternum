
"""
    functions to help convert position(col, row) or position(x,y)
    to Cube coordinates and calculate distance between two positions

    Reading this article will help you understand the code:
    https://www.redblobgames.com/grids/hexagons/

"""
class Hex: 
    def __init__(self, col, row):
        self.col = col
        self.row = row

    def cube(self):
        #https://www.redblobgames.com/grids/hexagons/#conversions-offset
        # convert from odd-r to cube coordinates
        q = self.col - (self.row - (self.row & 1)) / 2
        r = self.row
        return Cube(q, r, -q - r)

class Cube:
    def __init__(self, q, r, s):
        self.q = q
        self.r = r
        self.s = s

    def subtract(self, b):
        return Cube(self.q - b.q, self.r - b.r, self.s - b.s)
    
    def distance(self, b):
        #https://www.redblobgames.com/grids/hexagons/#distances-cube
        diff = self.subtract(b)
        return max(abs(diff.q), abs(diff.r), abs(diff.s))
    
    def travel_time(self, b, sec_per_kn):
        return self.distance(b) * sec_per_kn