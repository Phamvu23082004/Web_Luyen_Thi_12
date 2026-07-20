import { render, screen } from '@testing-library/react'
import { Button } from './button'

describe('Button variants', () => {
  it('renders the primary variant with a solid primary background', () => {
    render(<Button>Nộp bài</Button>)
    const btn = screen.getByRole('button', { name: 'Nộp bài' })
    expect(btn).toHaveClass('bg-primary')
    expect(btn).toHaveAttribute('type', 'button')
  })

  it('renders the secondary variant with a border and no primary fill', () => {
    render(<Button variant="secondary">Huỷ</Button>)
    const btn = screen.getByRole('button', { name: 'Huỷ' })
    expect(btn).toHaveClass('border')
    expect(btn).not.toHaveClass('bg-primary')
  })

  it('renders the ghost variant with primary text and no background/border', () => {
    render(<Button variant="ghost">Bỏ qua</Button>)
    const btn = screen.getByRole('button', { name: 'Bỏ qua' })
    expect(btn).toHaveClass('text-primary')
    expect(btn).not.toHaveClass('border')
  })
})
