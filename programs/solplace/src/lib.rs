use anchor_lang::prelude::*;

declare_id!("5wverGuNkKAs6FQbQ741Ht58W4FsmLBXSvmLJSjBhMAG");

#[program]
pub mod solplace {

    use super::*;

    const MIN_POS: u8 = 0;
    const MAX_POS: u8 = 255;
    const MIN_COL: u8 = 0;
    const MAX_COL: u8 = 255;

    pub fn init_vault(
        ctx: Context<InitVault>
    ) -> Result<()> {
        
        let vault = &mut ctx.accounts.vault;

        vault.owner = ctx.accounts.user.key();
        
        Ok(())
    }

    pub fn create_pixel(
        ctx: Context<CreatePixel>,
        pos_x: u8,
        pos_y: u8,
        init_col_r: u8,
        init_col_g: u8,
        init_col_b: u8,
        lamports_per_slot: u64,
        nb_slots: u64,
    ) -> Result<()> {

        // Validation
        if pos_x < MIN_POS || pos_x > MAX_POS {
            return Err(error!(ErrorCode::InvalidXCoordinate));
        }

        if pos_y < MIN_POS || pos_y > MAX_POS {
            return Err(error!(ErrorCode::InvalidYCoordinate));
        }

        if init_col_r < MIN_COL || init_col_r > MAX_COL {
            return Err(error!(ErrorCode::InvalidRColor));
        }

        if init_col_b < MIN_COL || init_col_b > MAX_COL {
            return Err(error!(ErrorCode::InvalidBColor));
        }

        if init_col_g < MIN_COL || init_col_g > MAX_COL {
            return Err(error!(ErrorCode::InvalidGColor));
        }

        if lamports_per_slot < 1 {
            return Err(error!(ErrorCode::InvalidLamportsPerSlot));
        }

        if nb_slots < 1 {
            return Err(error!(ErrorCode::InvalidNumberSlots));
        }

        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.user.key(),
            &ctx.accounts.vault.key(),
            nb_slots * (lamports_per_slot as u64),
        );
        
        let result = anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ]
        );

        if result.is_err() {
            return Err(error!(ErrorCode::PaymentInvalid));
        }

        // Set values
        let pixel = &mut ctx.accounts.pixel;
        pixel.pos_x = pos_x;
        pixel.pos_y = pos_y;
        pixel.col_r = init_col_r;
        pixel.col_g = init_col_g;
        pixel.col_b = init_col_b;
        pixel.bump = *ctx.bumps.get("pixel").unwrap();

        pixel.lamport_per_slot = lamports_per_slot;
        pixel.last_slot = Clock::get()?.slot + nb_slots;
        pixel.bidder = ctx.accounts.user.key();

        // Emit event
        emit!(PixelChanged {
            pos_x,
            pos_y,
            col_r: init_col_r,
            col_g: init_col_g,
            col_b: init_col_b,
            lamport_per_slot: lamports_per_slot,
            last_slot: Clock::get()?.slot + nb_slots,
            bidder: ctx.accounts.user.key(),
        });

        Ok(())
    }

    pub fn update_pixel(
        ctx: Context<UpdatePixel>,
        new_col_r: u8,
        new_col_g: u8,
        new_col_b: u8,
        lamports_per_slot: u64,
        nb_slots: u64,
    ) -> Result<()> {
        // Validation
        if new_col_r < MIN_COL || new_col_r > MAX_COL {
            return Err(error!(ErrorCode::InvalidRColor));
        }
    
        if new_col_g < MIN_COL || new_col_g > MAX_COL {
            return Err(error!(ErrorCode::InvalidBColor));
        }
    
        if new_col_b < MIN_COL || new_col_b > MAX_COL {
            return Err(error!(ErrorCode::InvalidGColor));
        }
    
        if Clock::get()?.slot < ctx.accounts.pixel.last_slot && lamports_per_slot <= ctx.accounts.pixel.lamport_per_slot {
            return Err(error!(ErrorCode::InvalidLamportsPerSlot));
        }

        if Clock::get()?.slot >= ctx.accounts.pixel.last_slot && lamports_per_slot < 1 {
            return Err(error!(ErrorCode::InvalidLamportsPerSlot));
        }

        if nb_slots < 1 {
            return Err(error!(ErrorCode::InvalidNumberSlots));
        }

        if (ctx.accounts.pixel.last_slot - Clock::get()?.slot) * ctx.accounts.pixel.lamport_per_slot >= nb_slots * lamports_per_slot {
            return Err(error!(ErrorCode::InvalidNumberSlotsXLamportsPerSlot));
        }

        if Clock::get()?.slot < ctx.accounts.pixel.last_slot {

            **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= (ctx.accounts.pixel.last_slot - Clock::get()?.slot) * (lamports_per_slot as u64);
            **ctx.accounts.bidder.try_borrow_mut_lamports()? += (ctx.accounts.pixel.last_slot - Clock::get()?.slot) * (lamports_per_slot as u64);

        }
 
        

        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.user.key(),
            &ctx.accounts.vault.key(),
            nb_slots * (lamports_per_slot as u64),
        );

        let result = anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ]
        );

        if result.is_err() {
            return Err(error!(ErrorCode::PaymentInvalid));
        }
         
        // Set values
        let pixel = &mut ctx.accounts.pixel;
        pixel.col_r = new_col_r;
        pixel.col_g = new_col_g;
        pixel.col_b = new_col_b;

        pixel.lamport_per_slot = lamports_per_slot;
        pixel.last_slot = Clock::get()?.slot + nb_slots;
        pixel.bidder = ctx.accounts.user.key();

        // Emit event
        emit!(PixelChanged {
            pos_x: pixel.pos_x,
            pos_y: pixel.pos_y,
            col_r: new_col_r,
            col_g: new_col_g,
            col_b: new_col_b,
            lamport_per_slot: lamports_per_slot,
            last_slot: Clock::get()?.slot + nb_slots,
            bidder: ctx.accounts.user.key(),
        });
    
        Ok(())
    }
}

#[account]
pub struct Vault {
    pub owner: Pubkey,
}

#[derive(Accounts)]
pub struct InitVault<'info> {
    #[account(
        init,
        payer = user,
        seeds = [b"vault".as_ref()],
        bump,
        space = 8 + 32,
    )]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(pos_x: u8, pos_y: u8)]
pub struct CreatePixel<'info> {
    #[account(
        init,
        payer = user,
        space = Pixel::LEN,
        seeds = [b"pixel".as_ref(), [pos_x, pos_y].as_ref()],
        bump
    )]
    pub pixel: Account<'info, Pixel>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        seeds = [b"vault".as_ref()],
        bump,
    )]
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePixel<'info> {
    #[account(
        mut,
        seeds = [b"pixel".as_ref(), [pixel.pos_x, pixel.pos_y].as_ref()],
        bump = pixel.bump,
    )]
    pub pixel: Account<'info, Pixel>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut, 
        seeds = [b"vault".as_ref()],
        bump,
    )]
    pub vault: Account<'info, Vault>,
    /// CHECK: Last Bidder account
    #[account(mut)]
    pub bidder: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Pixel {
    pub pos_x: u8,
    pub pos_y: u8,
    pub col_r: u8,
    pub col_g: u8,
    pub col_b: u8,
    pub bump: u8,
    pub lamport_per_slot: u64,
    pub last_slot: u64,
    pub bidder: Pubkey,
}

const DISCRIMINATOR_LENGTH: usize = 8;
const POS_LENGTH: usize = 1;
const COL_LENGTH: usize = 1;
const BUMP_LENGTH: usize = 1;
const LAMPORTS_LENGTH: usize = 8;
const SLOT_LENGTH: usize = 8;


impl Pixel {
    const LEN: usize = DISCRIMINATOR_LENGTH + (2 * POS_LENGTH) + (3 * COL_LENGTH) + BUMP_LENGTH + LAMPORTS_LENGTH + SLOT_LENGTH + 32;
}

#[error_code]
pub enum ErrorCode {
    #[msg("The given X co-ordinate is not between 0-99")]
    InvalidXCoordinate,
    #[msg("The given Y co-ordinate is not between 0-99")]
    InvalidYCoordinate,
    #[msg("The given R color is not between 0-255")]
    InvalidRColor,
    #[msg("The given G color is not between 0-255")]
    InvalidGColor,
    #[msg("The given B color is not between 0-255")]
    InvalidBColor,
    #[msg("The Lamports per slot is not bigger than the previous one")]
    InvalidLamportsPerSlot,
    #[msg("The number of slots is not bigger than 0")]
    InvalidNumberSlots,
    #[msg("Payment Invalid")]
    PaymentInvalid,
    #[msg("Refund Invalid")]
    RefundInvalid,
    #[msg("Number Slots X Lamports Per Slot Invalid")]
    InvalidNumberSlotsXLamportsPerSlot,
}

#[event]
pub struct PixelChanged {
    pub pos_x: u8,
    pub pos_y: u8,
    pub col_r: u8,
    pub col_g: u8,
    pub col_b: u8,
    pub lamport_per_slot: u64,
    pub last_slot: u64,
    pub bidder: Pubkey,
}