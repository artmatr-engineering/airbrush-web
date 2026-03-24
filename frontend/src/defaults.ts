import type { AirbrushParams } from '@/components/Parameters';

export const defaultParams: AirbrushParams = {
  job_size: [1000, 1000],
  job_location: [0, 0],
  job_origin_corner: 'upper_left',
  print_channel: 'GRAYSCALE',
  padding_distance: 75,
  ramp_distances: [6, 6],
  y_step_distance: 1,
  ab_min: 0,
  ab_max: 500,
  z: 15,
  feedrate: 8000,
  gaussian_blur_radius: 2,
  print_direction: 'top_to_bottom',
  enable_gradient_border: false,
  gradient_border_width: 20,
  gradient_levels: 10,
  draw_bounding_box: false,
};
