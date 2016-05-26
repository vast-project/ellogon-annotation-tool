<?php

class ButtonAnnotatorController extends \BaseController {
	public function index() {
		try {
			$user = Sentry::getUser();
			return Response::json(array(
									'success' => true,
									'data'	  => ButtonAnnotator::where('user_id', $user['id'])
															   	->first(array('language', 'annotation_type', 'attribute', 'alternative'))));
		}catch(\Exception $e){
    		return Response::json(array('success' => false, 'message' => $e->getMessage()));
		}
	}

	//store an annotation schema
	public function store() {		
		try {
			$input = Input::get('data');
			$user = Sentry::getUser();
			$annotationSchemaExists = ButtonAnnotator::where('user_id', '=',  $user['id'])
													 ->get();

			if (!$annotationSchemaExists->count()){ 			//annotation schema does not exist -- save new annotation schema				
				$newAnnotationSchema = ButtonAnnotator::create(array(	
					'user_id' => $user['id'],		
					'language' => $input['language'],					
					'annotation_type' => $input['annotation_type'],
					'attribute' => $input['attribute'],
					'alternative' => $input['alternative']
				));
			} else {										//annotation schema exists -- update it
				$newAnnotationSchema = ButtonAnnotator::where('user_id', '=',  $user['id'])->update(array(
					'language' => $input['language'],					
					'annotation_type' => $input['annotation_type'],
					'attribute' => $input['attribute'],
					'alternative' => $input['alternative']
				));
			} 
	    }catch(\Exception $e){
    		return Response::json(array('success' => false, 'message' => $e->getMessage()));
		}

		return Response::json(array('success' => true));
	}
}