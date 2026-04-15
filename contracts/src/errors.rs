use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum FluppyError {
    UnauthorizedMember = 1,
    InsufficientBalance = 2,
    InvalidPaymentAmount = 3,
    Overflow = 4,
}