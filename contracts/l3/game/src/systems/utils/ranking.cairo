pub fn competition_rank(previous_points: u128, current_points: u128, ranked_count: u16) -> u16 {
    if ranked_count == 0 {
        return 1;
    }
    assert!(previous_points >= current_points, "Eternum: Players list not ordered by points");
    if previous_points > current_points {
        return ranked_count + 1;
    }
    0
}

/// Reserve the tied group's pool before dividing it. The remainder must not
/// become a bonus for a later rank or depend on the submitted address order.
pub fn allocate_tied_chests(points: u128, total_points: u128, allocated: u16, count: u16, ref remaining: u16) -> u16 {
    assert!(count > 0, "Eternum: empty chest allocation group");
    let base: u256 = if points >= 500_000_000 {
        1
    } else {
        0
    };
    let proportional: u256 = if total_points == 0 {
        0
    } else {
        Into::<u16, u256>::into(allocated) * points.into() / total_points.into()
    };
    let requested = (base + proportional) * count.into();
    let reserved: u16 = if requested > remaining.into() {
        remaining
    } else {
        requested.try_into().unwrap()
    };
    remaining -= reserved;
    reserved / count
}

#[cfg(test)]
mod tests {
    use super::{allocate_tied_chests, competition_rank};

    fn ranks(points: Array<u128>) -> Array<u16> {
        let mut result = array![];
        let mut previous = 0;
        let mut rank = 0;
        let mut count = 0;
        for points in points {
            let next = competition_rank(previous, points, count);
            if next != 0 {
                rank = next;
            }
            result.append(rank);
            previous = points;
            count += 1;
        }
        result
    }

    #[test]
    fn tie_group_consumes_all_positions() {
        assert!(ranks(array![100, 100, 50]) == array![1, 1, 3], "expected 1,1,3");
    }

    #[test]
    fn multiple_tie_groups_use_competition_ranks() {
        assert!(ranks(array![100, 80, 80, 20]) == array![1, 2, 2, 4], "expected 1,2,2,4");
    }

    #[test]
    fn zero_point_players_share_the_last_rank() {
        assert!(ranks(array![100, 0, 0]) == array![1, 2, 2], "zero-point tie was not ranked");
    }

    #[test]
    fn tied_chests_are_equal_and_leave_dust_unallocated() {
        let mut remaining = 11;
        let chests = allocate_tied_chests(500_000_000, 1_000_000_000, 11, 2, ref remaining);
        assert!(chests == 5, "tied players must receive five each");
        assert!(remaining == 0, "the leftover chest must not be awarded to another rank");
    }

    #[test]
    fn tied_chests_pool_the_clipped_budget() {
        let mut remaining = 10;
        assert!(allocate_tied_chests(500_000_000, 1_000_000_000, 10, 2, ref remaining) == 5, "expected five each");
        assert!(remaining == 0, "group did not reserve its full allocation");
    }

    #[test]
    fn zero_points_do_not_receive_chests() {
        let mut remaining = 10;
        assert!(allocate_tied_chests(0, 0, 10, 2, ref remaining) == 0, "zero points earned chests");
        assert!(remaining == 10, "zero points consumed the budget");
    }

    #[test]
    fn untied_rewards_retain_threshold_and_proportion() {
        let mut remaining = 20;
        assert!(allocate_tied_chests(600_000_000, 1_000_000_000, 20, 1, ref remaining) == 13, "top reward changed");
        assert!(allocate_tied_chests(400_000_000, 1_000_000_000, 20, 1, ref remaining) == 7, "clipping changed");
    }
}
