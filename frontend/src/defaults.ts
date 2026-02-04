import type { AirbrushParams } from '@/components/Parameters';

export const defaultParams: AirbrushParams = {
  job_size: [1000, 1000],
  job_location: [0, 0],
  print_channel: 'GRAYSCALE',
  padding_distance: 75,
  ramp_distances: [6, 6],
  y_step_distance: 0.5,
  ab_min: 0,
  ab_max: 500,
  z: 15,
  feedrate: 4000,
  gaussian_blur_radius: 2,
  print_direction: 'bottom_to_top',
  enable_gradient_border: false,
  gradient_border_width: 40,
  gradient_levels: 10,
};
