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

#[cfg(test)]
mod tests {
    use super::competition_rank;

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
}
