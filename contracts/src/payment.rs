pub fn calculate_split(amount: i128, percentage: i128) -> (i128, i128) {
    let dev_share = (amount * percentage) / 10000;
    let owner_share = amount - dev_share;
    (owner_share, dev_share)
}
