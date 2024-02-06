mod levels {
    use cubit::f128::types::fixed::{FixedTrait, Fixed,ONE_u128};
    use eternum::utils::map::constants::fixed_constants::{_0_25, _0_5, _0_53, _0_6,_0_72, _0_8};

    fn DEEP_OCEAN_LEVEL() -> Fixed {
        _0_25()
    }

    fn OCEAN_LEVEL() -> Fixed {
        _0_5()
    }

    fn SAND_LEVEL() -> Fixed {
        _0_53()
    }

    fn FOREST_LEVEL() -> Fixed {
        _0_6()
    }

    fn DESERT_LEVEL() -> Fixed {
        _0_72()
    }

    fn MOUNTAIN_LEVEL() -> Fixed {
        _0_8()
    }
}


mod biomes {
    use cubit::f128::types::fixed::{FixedTrait, Fixed,ONE_u128};
    use eternum::utils::map::constants::fixed_constants::{
        _0_1, _0_2, _0_3, _0_4, _0_5, _0_6, _0_7, _0_8, _1, _2, _100
    };
    
    fn DEEP_OCEAN() -> Fixed {
        _0_1()
    } 

    fn OCEAN() -> Fixed {
        _0_1()
    }

    fn BEACH() -> Fixed {
        _0_2()
    }

    fn SCORCHED() -> Fixed {
        _0_8()
    }

    fn BARE() -> Fixed {
        _0_7()
    }

    fn TUNDRA() -> Fixed {
        _0_6()
    }

    fn SNOW() -> Fixed {
        _0_5()
    }

    fn TEMPERATE_DESERT() -> Fixed {
        _0_4()
    }

    fn SHRUBLAND() -> Fixed {
        _0_5()
    }

    fn TAIGA() -> Fixed {
        _0_6()
    }

    fn GRASSLAND() -> Fixed {
        _0_4()
    }

    fn TEMPERATE_DECIDUOUS_FOREST() -> Fixed {
        _0_5()
    }

    fn TEMPERATE_RAIN_FOREST() -> Fixed {
        _0_7()
    }

    fn SUBTROPICAL_DESERT() -> Fixed {
        _0_3()
    }

    fn TROPICAL_SEASONAL_FOREST() -> Fixed {
        _0_5()
    }

    fn TROPICAL_RAIN_FOREST() -> Fixed {
        _0_6()
    }

}




use cubit::f128::procgen::simplex3;
use cubit::f128::types::fixed::{FixedTrait, Fixed};
use cubit::f128::types::vec3::{Vec3, Vec3Trait};
use eternum::utils::map::constants::fixed_constants::{
    _0,_0_16,_0_33, _0_66, _0_83, _1, _2, _0_4, _0_5, _100, _0_25, _0_1
};
use eternum::utils::map::biomes::biomes as BIOMES;
use eternum::utils::map::biomes::levels::{
    DEEP_OCEAN_LEVEL, OCEAN_LEVEL, SAND_LEVEL, FOREST_LEVEL, DESERT_LEVEL, MOUNTAIN_LEVEL
};



fn MAP_AMPLITUDE() -> Fixed {
    FixedTrait::new_unscaled(60, false)
}



fn ELEVATION_OCTAVES() -> Array<Fixed> {
    array![_1(), _0_25(), _0_1()]
}



fn ELEVATION_OCTAVES_SUM() -> Fixed {
    let mut octaves = ELEVATION_OCTAVES();
    let mut sum = _0();
    loop {
        match octaves.pop_front() {
            Option::Some(octave) => {
                sum += octave;
            },
            Option::None => {break;},
        }
    };
    sum
}



fn get_biome(col: u128, row: u128) -> Fixed {
    let col_fixed = FixedTrait::new_unscaled(col, false);
    let row_fixed = FixedTrait::new_unscaled(row, false);
    let elevation = _elevation(col_fixed, row_fixed);
    let moisture = _moisture(col_fixed, row_fixed);
     _environment(elevation, moisture)
}



fn _elevation(col: Fixed, row: Fixed) -> Fixed {
    
    let mut elevation = _0();
    let mut octaves = ELEVATION_OCTAVES();
    let MAP_AMPLITUDE = MAP_AMPLITUDE();
    loop {
        match octaves.pop_front() {
            Option::Some(octave) => {
                let x = (col / octave) / MAP_AMPLITUDE;
                let z = (row / octave) / MAP_AMPLITUDE;
                let vec = Vec3Trait::new(x, _0(), z);
                let noise = simplex3::noise(vec);
                let noise = noise + _1();
                let noise = noise * _100();
                let noise = noise / _2();
                elevation += octave * noise.floor();
            },
            Option::None => {break;},
        }
    };

    elevation = elevation / ELEVATION_OCTAVES_SUM();
    elevation = elevation / _100();
    elevation
}


fn _moisture(col: Fixed, row: Fixed) -> Fixed {
    let MOISTURE_OCTAVE = _2();
    let MAP_AMPLITUDE = MAP_AMPLITUDE();
    let moisture_x = (MOISTURE_OCTAVE * col) / MAP_AMPLITUDE; 
    let moisture_z = (MOISTURE_OCTAVE * row) / MAP_AMPLITUDE;
    let vec = Vec3Trait::new(moisture_x, _0(), moisture_z);
    let noise = simplex3::noise(vec);
    let noise = noise + _1();
    let noise = noise * _100();
    let noise = noise / _2();
    let moisture = noise.floor() / _100();
    moisture
}



fn _environment(elevation: Fixed, moisture: Fixed) -> Fixed {

    let depth = if elevation < DEEP_OCEAN_LEVEL(){
            BIOMES::DEEP_OCEAN()
        } else if elevation < OCEAN_LEVEL() {
            BIOMES::OCEAN()
        } else if elevation < SAND_LEVEL() {
            BIOMES::BEACH()
        } else if elevation > MOUNTAIN_LEVEL() {
            if moisture < _0_1() {
                BIOMES::SCORCHED()
            } else if moisture < _0_4() {
                BIOMES::BARE()
            } else if moisture < _0_5() {
                BIOMES::TUNDRA()
            } else {
                BIOMES::SNOW()
            }
        } else if elevation > DESERT_LEVEL() {
            if moisture < _0_33() {
                BIOMES::TEMPERATE_DESERT()
            } else if moisture < _0_66() {
                BIOMES::SHRUBLAND()
            } else {
                BIOMES::TAIGA()
            }
        } else if elevation > FOREST_LEVEL() {
            if moisture < _0_16() {
                BIOMES::TEMPERATE_DESERT()
            } else if moisture < _0_5() {
                BIOMES::GRASSLAND()
            } else if moisture < _0_83() {
                BIOMES::TEMPERATE_DECIDUOUS_FOREST()
            } else {
                BIOMES::TEMPERATE_RAIN_FOREST()
            }
        } else {
            if moisture < _0_16() {
                BIOMES::SUBTROPICAL_DESERT()
            } else if moisture < _0_33() {
                BIOMES::GRASSLAND()
            } else if moisture < _0_66() {
                BIOMES::TROPICAL_SEASONAL_FOREST()
            } else {
                BIOMES::TROPICAL_RAIN_FOREST()
            }
        };

    return depth;    
}




#[cfg(test)]
mod tests {

    use cubit::f128::types::fixed::{FixedTrait, Fixed};
    use super::get_biome;

    #[test]
    fn test_noisy() {
        get_biome(1128, 389);
    }
}