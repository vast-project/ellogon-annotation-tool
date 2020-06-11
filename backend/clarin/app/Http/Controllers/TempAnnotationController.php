<?php

class TempAnnotationController extends \BaseController {
    //apply filter for the shared/non-shared collections 
    public function __construct() {					
    	$this->beforeFilter('collection_permissions'); 
    }

	//get all the temp annotations of a document
	public function index($collection_id, $document_id) {
		try {
			return Response::json(array(
									'success' => true,
									'data'	  => TempAnnotation::where('collection_id', (int) $collection_id)
															   ->where('document_id', (int) $document_id)
								   							   ->get(array('collection_id', 'document_id', 'type', 'spans', 'attributes'))));
		}catch(\Exception $e){
    		return Response::json(array('success' => false, 'message' => $e->getMessage()));
		}
	}

	//get the spacific temp annotations of a document
	public function show($collection_id, $document_id, $annotation_id) {
		try {
			return Response::json(array(
									'success' => true,
									'data'	  => TempAnnotation::find($annotation_id)));
		}catch(\Exception $e){
    		return Response::json(array('success' => false, 'message' => $e->getMessage()));
		}
	}

	//store a new annotation
	public function store($collection_id, $document_id)
	{		
		try {
			$user = Sentinel::getUser();
			$new_annotations = []; 
			$annotation_data = Input::get('data');

			if ((bool)count(array_filter(array_keys($annotation_data), 'is_string'))) { //if the user send a single annotation
				$anno = new TempAnnotation(array(	
					'_id' => $annotation_data['_id'],					
					'document_id' => $annotation_data['document_id'],
					'collection_id' => $annotation_data['collection_id'],
					'owner_id' => $user['id'],
					'type' => $annotation_data['type'],
					'spans' => $annotation_data['spans'],
					'attributes' => $annotation_data['attributes'],
					'updated_by' => $user['email']
				));

				$document = Document::find($document_id);
				$document->temp_annotations()->save($anno);
			
				OpenDocument::where('collection_id', (int) $collection_id)
							->where('document_id', (int) $document_id)
							->increment('db_interactions');
			} else {																	//if the user send an array with annotations				
				foreach ($annotation_data as $annotation) {
				    $anno = new TempAnnotation(array(	
						'_id' => $annotation['_id'],					
						'document_id' => $annotation['document_id'],
						'collection_id' => $annotation['collection_id'],
						'owner_id' => $user['id'],
						'type' => $annotation['type'],
						'spans' => $annotation['spans'],
						'attributes' => $annotation['attributes'],
						'updated_by' => $user['email']
					));

				    array_push($new_annotations, $anno);
				}

				$document = Document::find($document_id);				
				$document->temp_annotations()->saveMany($new_annotations);
			}
	    }catch(\Exception $e){
    		return Response::json(array('success' => false, 'message' => $e->getMessage()));
		}

		return Response::json(array('success' => true));
	}

	//update specific annotation
	public function update($collection_id, $document_id, $annotation_id) {		
		$annotation = Input::get('data');
		try {
			$user = Sentinel::getUser();

			$anno = TempAnnotation::find($annotation_id);
			$anno->type = $annotation['type'];
			$anno->spans = $annotation['spans'];
			$anno->attributes = $annotation['attributes'];
			$anno->updated_by = $user['email'];
			$anno->save();

			OpenDocument::where('collection_id', (int) $collection_id)
						->where('document_id', (int) $document_id)
						->increment('db_interactions');
	    }catch(\Exception $e){
    		return Response::json(array('success' => false, 'message' => $e->getMessage()));
		}

		return Response::json(array('success' => true));
	}

	//destroy specific annotation
	public function destroy($collection_id, $document_id, $annotation_id) {
		try {
			$user = Sentinel::getUser();
			
			if(is_null($annotation_id) || $annotation_id === 'null'){ 
				TempAnnotation::withTrashed()
							  /*->where('owner_id', $owner['id'])*/
						      ->where('collection_id', (int) $collection_id)
						      ->where('document_id', (int) $document_id)
							  ->forceDelete();
			} else {
				TempAnnotation::destroy($annotation_id);

				OpenDocument::where('collection_id', (int) $collection_id)
							->where('document_id', (int) $document_id)
							->increment('db_interactions');			
			}
		}catch(\Exception $e){
    		return Response::json(array('success' => false, 'message' => $e->getMessage()));
		}

		return Response::json(array('success' => true));
	}




	 /**
     * action to handle streamed response from laravel
     * @return \Symfony\Component\HttpFoundation\StreamedResponse
     */
    public function liveUpdate($collection_id, $document_id) {
    	set_time_limit(0);

        $response = new Symfony\Component\HttpFoundation\StreamedResponse();
        $response->headers->set('Content-Type', 'text/event-stream');

        $response->setCallback(function () use ($collection_id, $document_id){
        	$owner = Sentinel::getUser();

    		$elapsed_time = 0;
    		$started_time = new DateTime();
    		$started_time = $started_time->sub(new DateInterval('PT7S'));  //look for annotations performed 7 seconds ago from now

        	while (true) {        		
        		if($elapsed_time>100)		// Cap connections at 100 sec. The browser will reopen the connection on close
        			die();

        		$is_owner = DB::table('collections')
							  ->where('id', (int) $collection_id) 
					  		  ->where('owner_id', $owner['id'])
					  		  ->count();

				if ($is_owner == 0) {
					$is_shared = DB::table('shared_collections')
								   ->where('collection_id', (int) $collection_id) 
						  		   ->where('to', $owner['email'])
						  		   ->count();

					if($is_shared == 0 ) {
						echo 'data: ' . json_encode('You do not have access to this document. Please select another document.') . "\n\n";		//send data to client
			            ob_flush();
			            flush();

					}
				}

			  	$started_time_new = new DateTime();
        		$new_annotations = TempAnnotation::withTrashed()	 
											   	 ->where('collection_id', (int) $collection_id)
												 ->where('document_id', (int) $document_id)
												 ->where('updated_at', '>=', $started_time)
												 ->get(array('_id', 'collection_id', 'document_id', 'type', 'spans', 'attributes', /*'updated_at', 'updated_by',*/'deleted_at'));

			    if (sizeof($new_annotations)>0) {
			    	$started_time = $started_time_new;
			    	$elapsed_time = 0;

				    echo 'data: ' . json_encode($new_annotations) . "\n\n";		//send data to client
		            ob_flush();
		            flush();
		        } else
		        	$elapsed_time += 4;
	        	
	        	sleep(3);
            }
		});

        return $response;
    }
}
