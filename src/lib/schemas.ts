import type {
  ChangePasswordRequest,
  CollectorInfo,
  LoginRequest,
  RegisterRequest,
  UpdateProfileRequest,
  WalletInput,
} from '@/api/contracts'
import { rules, validate } from './validation'

export function validateLogin(v: LoginRequest) {
  return validate(v, { email: rules.email, password: rules.required('a senha') })
}

export function validateRegister(v: RegisterRequest) {
  const errors = validate(v, { username: rules.username, email: rules.email, password: rules.password })
  if (!v.confirmPassword) errors.confirmPassword = 'Confirme a senha.'
  else if (v.confirmPassword !== v.password) errors.confirmPassword = 'As senhas não coincidem.'
  return errors
}

export function validateProfile(v: UpdateProfileRequest) {
  return validate(v, {
    displayName: rules.displayName,
    username: rules.username,
    email: rules.email,
    ensName: rules.ensName,
    walletNickname: rules.shortText('o apelido da carteira', 30),
  })
}

export function validatePasswordChange(v: ChangePasswordRequest) {
  const errors = validate(v, { currentPassword: rules.required('a senha atual'), newPassword: rules.password })
  if (!errors.newPassword && v.newPassword === v.currentPassword) errors.newPassword = 'A nova senha deve ser diferente da atual.'
  if (!v.confirmPassword) errors.confirmPassword = 'Confirme a nova senha.'
  else if (v.confirmPassword !== v.newPassword) errors.confirmPassword = 'As senhas não coincidem.'
  return errors
}

export function validateWallet(v: WalletInput) {
  return validate(v, {
    displayName: rules.displayName,
    nickname: rules.shortText('o apelido da carteira', 30),
    network: rules.network,
    profileName: rules.shortText('o nome do perfil', 30),
    address: rules.address,
    secondaryAddress: rules.optionalSecondary,
    provider: rules.provider,
    referralCode: rules.referral,
    email: rules.email,
    ensName: rules.ensName,
  })
}

export function validateCollector(v: CollectorInfo) {
  return validate(v, {
    displayName: rules.displayName,
    username: rules.username,
    profileName: rules.shortText('o nome do perfil', 30),
    email: rules.email,
    walletAddress: rules.address,
    secondaryAddress: rules.optionalSecondary,
    referralCode: rules.referral,
    ensName: rules.ensName,
    note: rules.maxLength(500),
  })
}
